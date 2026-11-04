import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const config = JSON.parse(await readFile(resolve(process.argv[2] ?? 'config.json'), 'utf8'));
const words = text => new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter(word => word.length > 2 && !/^(the|and|for|you|was|did|with|that|this|have|what|about)$/.test(word)));
const send = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
};

http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ready: true });
    if (req.url !== '/query') return send(res, 404, { error: 'Unknown route' });
    if (req.headers.origin && req.headers.origin !== config.origin) {
        return send(res, 403, { error: 'Origin not allowed' });
    }
    res.setHeader('Access-Control-Allow-Origin', config.origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.writeHead(204).end();
    if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
    try {
        let body = '';
        for await (const chunk of req) {
            body += chunk;
            if (body.length > 16000) return send(res, 413, { error: 'Request too large' });
        }
        const { chatId, query, before } = JSON.parse(body);
        if (typeof chatId !== 'string' || typeof query !== 'string' || !Number.isSafeInteger(before) || before < 0) {
            return send(res, 400, { error: 'Expected chatId, query and nonnegative before index' });
        }
        if (!Object.hasOwn(config.chats, chatId)) return send(res, 200, { excerpts: [] });
        const raw = await readFile(resolve(config.chats[chatId]), 'utf8');
        const rows = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
        // SillyTavern character chats begin with metadata, followed by messages.
        if (!rows.length || Object.hasOwn(rows[0], 'mes')) throw new Error('Expected metadata header');
        const messages = rows.slice(1, before + 1);
        const terms = words(query);
        const hits = messages.flatMap((row, index) => {
            if (row.is_system || typeof row.mes !== 'string') return [];
            const rowWords = words(row.mes);
            const score = [...terms].filter(term => rowWords.has(term)).length;
            return score >= 2 ? [{ score, index }] : [];
        }).sort((a, b) => b.score - a.score || b.index - a.index);
        const excerpts = [];
        const used = new Set();
        for (const hit of hits) {
            if (used.has(hit.index)) continue;
            const pairStart = !messages[hit.index].is_user && messages[hit.index - 1]?.is_user ? hit.index - 1 : hit.index;
            for (let index = pairStart; index <= pairStart + 1 && index < messages.length; index++) {
                const row = messages[index];
                if (!used.has(index) && !row.is_system && typeof row.mes === 'string') {
                    used.add(index);
                    excerpts.push({ index, speaker: row.name ?? 'Unknown', text: row.mes.slice(0, 900) });
                }
            }
            if (excerpts.length >= 4) break;
        }
        return send(res, 200, { excerpts: excerpts.slice(0, 4) });
    } catch {
        return send(res, 400, { error: 'Invalid request or unreadable registered chat' });
    }
}).listen(config.port ?? 8018, '127.0.0.1', () => console.log('Exact Excerpt Starter listening on loopback'));
