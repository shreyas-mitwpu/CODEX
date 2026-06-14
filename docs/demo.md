# FactoryMind Browser Demo

This is the low-risk judging version:

```text
Browser -> FactoryMind Agent UI -> Four-agent chain -> Live dashboard -> Firebase/local save
```

It avoids WhatsApp, Twilio, Supabase, and Claude during the demo. The original
backend code is still in the repository, but the default commands now run the
browser demo.

## Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Demo Script

For quick validation, click **Run FactoryMind Agents**.

For live judging, click **Run Judge Demo Mode**. It resets the page, runs the same
four-agent chain, and stretches the handoffs into a 34-second guided sequence.

The page is organized into the required three panels:

- Input Panel
- Agent Chain Panel
- Dashboard Panel

The chain executes:

- Agent 1: Intake Parser
- Agent 2: Stock Analyst
- Agent 3: Procurement Planner
- Agent 4: Executive Evaluator

Expected output:

- Judge hero shows agents collaborated, risks detected, procurement actions,
  schedules generated, and business value protected
- Agent cards update with status, timing, and confidence
- Each agent shows input received, analysis performed, decision made, and output passed forward
- Agent handoff timeline explains what Agent 1 passes to Agent 2, Agent 2 to Agent 3, and so on
- CEO Summary, Why AI, Before vs After, Confidence & Trust, and Winning Criteria Audit cards render
- Dashboard status metrics update progressively
- RED/BLACK alerts appear automatically
- Reorder cards render
- Procurement schedules render
- Business impact explains risks, recommended actions, procurement decisions, and value protected
- Evaluation report renders
- Savings counter animates
- Excel-compatible `.xls` report downloads from the report button

Judge narrative:

```text
Raw inventory text
  -> Agent 1 normalizes stock and usage rows
  -> Agent 2 detects stock risk and days remaining
  -> Agent 3 creates supplier-backed procurement actions
  -> Agent 4 produces executive impact, confidence, and savings
```

## Error Simulation

The input panel includes toggles for:

- Missing API key
- Failed OpenAI request
- Empty data
- Slow network
- Streaming interruption

Each mode is handled locally and should complete without a crash.

## Firebase

The demo uses the Firebase web project config supplied for `codex-13`. It loads
the session once, then saves changes after each run. It writes one document per
browser session under:

```text
factorymindAgentDemo/{sessionId}
```

If Firestore is unavailable or rules reject writes, the UI falls back to browser
local storage and keeps running.

For a short demo only, enable Cloud Firestore and use permissive rules:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /factorymindAgentDemo/{sessionId} {
      allow read, write: if true;
    }
  }
}
```

Do not use those rules for production. A production version should require
Firebase Authentication and restrict each session/user document.

## QA Commands

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run qa:stress
```

`npm run qa:stress` executes the complete demo path 20 times.

## Deployment

Railway uses the included Dockerfile and starts:

```bash
node dist/scripts/demo-server.js
```

Health check:

```text
/health
```

## Original API Mode

The full production API is still available:

```bash
npm run dev:api
npm run start:api
```

API mode still requires Supabase, Twilio, and Anthropic environment variables.
