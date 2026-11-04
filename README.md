# Exact Excerpt Retrieval for SillyTavern

This public starter demonstrates the central idea from my Valeria setup: bring a few original lines from older play into the next GM prompt. MemoryBooks and Smart Memory are separate extensions. This helper does not depend on them or repair their summary jobs.

## What it does

The extension takes the latest player message and current chat ID before generation. The local helper searches the registered JSONL transcript for older turns containing at least two shared words. It can return up to four original messages, with their zero-based message indices and speakers. The extension injects them as historical evidence. Unregistered chats get no excerpts. The lookup excludes the current player message and any later rows. Changing chats clears the previous result.

## 1. Run the fictional demo

Install Node.js 22 or later. Extract this package. In PowerShell, open the extracted folder and run:

```powershell
node helper.mjs
```

Keep that window open. The starter uses port 8019 so it can run alongside the original Valeria helper on port 8018. From a second PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8019/health
$body = @{ chatId = 'tea-demo'; query = 'guild clerk tea'; before = 2 } | ConvertTo-Json
$result = Invoke-RestMethod http://127.0.0.1:8019/query -Method Post -ContentType application/json -Body $body
$result.excerpts | Format-Table index,speaker,text
```

Expect indices 0 and 1. Repeat with an unknown chat ID and expect an empty list. The helper listens only on loopback and accepts browser requests from the configured SillyTavern origin.

## 2. Register a test chat

Make a disposable SillyTavern character chat and play a short exchange with a memorable detail. Find its saved JSONL file in your SillyTavern user's chats folder. Keep the metadata header. This starter uses the saved transcript and assumes the active chat and registered file share the same message indices. Register each fork separately. When using a frozen export, refresh the export if you edit or rewind that chat. A current saved file is preferable.

Open `config.json`. Set `origin` to the exact URL origin in your browser, including the port. Add the chat ID, normally the JSONL filename without the extension for a character chat, under `chats`. Use the full file path with forward slashes, for example:

```json
{
  "origin": "http://127.0.0.1:8000",
  "port": 8019,
  "chats": { "your-test-chat": "C:/your/path/your-test-chat.jsonl" }
}
```

Restart the helper after editing configuration. Relative transcript paths are resolved from the folder where you run the helper.

## 3. Install the browser extension

Copy the supplied `extension` folder to `public/scripts/extensions/third-party/Exact-Excerpt-Starter` inside SillyTavern. The destination should directly contain `manifest.json` and `index.js`. If you change the helper port, change the endpoint in `index.js` to match. Refresh SillyTavern and enable **Exact Excerpt Starter** in Extensions. Use a desktop browser on the same computer as the helper.

## 4. Verify retrieval and prompt delivery

Send a turn that repeats at least two distinctive words from the older exchange. In the browser developer console, look for **Attached message indices**. In SillyTavern's prompt inspector, look for **Historical excerpts from this chat** and verify the quoted lines. The console confirms the extension attached evidence; the prompt inspector confirms what was assembled for the GM. Separately check what the GM did with it. Try a second, unregistered chat to check for carryover. Stop the helper and send a test turn to check that normal generation still works after the timeout.

## 5. Troubleshoot

- **Health fails:** Check the helper window, Node version and port. Start the helper from the package folder.
- **Health works, browser lookup fails:** Check that the browser and helper are on the same machine, the configured origin matches the browser, and the extension endpoint matches the helper port.
- **Empty result:** Verify chat ID, JSONL path, message cutoff and query words. A missed lookup is not evidence that an event never happened.
- **Evidence in the console but absent from the prompt:** Check your SillyTavern version and prompt configuration. The starter uses the pre-generation hook and an in-chat prompt at depth 0. Verify this against your actual backend before relying on it.
- **MemoryBooks says “Token warning threshold exceeded”:** That job is separate. A large backlog needs smaller contiguous ranges starting after the last saved memory, for example `/scenememory 916-945` when 915 is the last saved message. The original setup was patched to cap automatic runs at 30 messages and shrink oversized batches. That patch is specific to the installed MemoryBooks build and is not part of this starter.

## How it differs from my live setup

The original Valeria helper uses prepared search indexes, additional source checks and support specific to that campaign. One latency fix cached parsed indexes while checking file identity and avoided searching every archived copy to find the newest matching capture. This starter reads one registered transcript per lookup and uses word overlap. It demonstrates the lookup, scope, prompt injection, timeout and fallback with fictional data. It contains no Valeria history, indexes, settings or credentials. Keep the service local. Your selected GM provider will receive any excerpt included in its outgoing prompt.

The demo's HTTP lookup, branch isolation, empty match and cutoff were tested. The starter extension passed syntax checks. Complete step 4 to verify the browser-to-prompt flow on your installation.
