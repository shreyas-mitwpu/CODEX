# Factory Agent MVP

Local MVP for three text-driven factory helpers:

- Inventory Agent: parses item names, quantities, thresholds, and inventory status.
- Production Agent: parses line statuses and capacity; accepts an optional photo attachment name.
- Maintenance Agent: parses service history, risk scores, urgency, and recommended service dates.

## Run

From this folder:

```powershell
npm start
```

Or directly:

```powershell
node server.mjs
```

Then open:

```text
http://localhost:4173
```

## Main Files

- `server.mjs`: local HTTP server and API endpoints.
- `src/agents.mjs`: text parsers and Excel workbook generation.
- `public/index.html`: single-page app shell.
- `public/styles.css`: UI styling.
- `public/app.js`: frontend tab, preview, upload, and download behavior.

## Notes

The parsing is local and heuristic. It can be replaced later with a Claude/OpenAI structured extraction call while keeping the same UI and Excel generation flow.
