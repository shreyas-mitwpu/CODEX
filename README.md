# FactoryMind

FactoryMind now includes a low-risk browser judging demo plus the original
production API code. The default commands run the browser demo:

```text
Browser -> FactoryMind Agent UI -> Agent handoffs -> Live impact dashboard -> Firebase/local save
```

Run it with:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and click **Run FactoryMind Agents**.

See [`docs/demo.md`](docs/demo.md) for the exact demo script and Firebase notes.

The original backend remains available through `npm run dev:api` and
`npm run start:api`.

FactoryMind is also a production-oriented WhatsApp inventory service for factories. It
accepts English and Hinglish stock messages through Twilio, extracts structured
inventory data with Claude Sonnet, stores an immutable ledger in Supabase
PostgreSQL, calculates consumption and stock risk, sends deduplicated low-stock
alerts, and generates Excel workbooks.

## Capabilities

- Twilio signature-verified WhatsApp webhook
- Registered-user lookup by E.164 phone number
- Claude Sonnet structured extraction with deterministic fallback
- Morning snapshots and evening consumption updates
- Transactional, append-only stock and audit history
- Current stock, average usage, days remaining, and dashboard summaries
- RED transition alerts with atomic deduplication and retry-safe delivery claims
- Fastest-supplier recommendations
- Three-sheet Excel reports delivered directly or through expiring media links
- API key and scheduler-secret authentication, rate limiting, CORS, Helmet, and
  structured Pino logging
- Docker, Railway config, migrations, seed data, tests, and GitHub Actions CI

## Architecture

```text
Twilio WhatsApp
      |
      v
Express webhook -> signature check -> idempotent inbound event
      |                                  |
      v                                  v
Claude parser/fallback            registered user lookup
      |
      v
Inventory service -> PostgreSQL transaction
      |                 |       |
      |                 |       +-> immutable audit event
      |                 +-> immutable stock ledger
      +-> RED transition -> pending alert + fastest supplier
                                      |
                                      v
                              Twilio delivery worker
```

Code is organized into HTTP routes, middleware, services, repositories, AI and
provider adapters, domain types, and pure utilities. See
[`docs/architecture.md`](docs/architecture.md) for the detailed design.

## Requirements

- Node.js 20+
- A Supabase project with a PostgreSQL connection string
- A Twilio account and WhatsApp-enabled sender
- An Anthropic API key
- Railway for the documented deployment path

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the environment file:

   ```bash
   cp .env.example .env
   ```

   On PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Set `DATABASE_URL` to the Supabase direct or session-pooler connection string.
   Use the direct/session connection for migrations. SSL is enabled by default.

4. Apply the schema and seed development master data:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Replace the sample user phone numbers in Supabase with real E.164 numbers,
   including the `+` prefix. Only active registered users can use the bot.

6. Start development mode:

   ```bash
   npm run dev
   ```

For local Twilio testing, expose port 3000 with a secure tunnel and set
`PUBLIC_BASE_URL` to the exact public HTTPS origin. Twilio signature validation
depends on the URL matching exactly.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `DATABASE_SSL` | Enable PostgreSQL TLS, normally `true` |
| `API_KEY` | At least 24 characters; required as `x-api-key` |
| `CRON_SECRET` | At least 24 characters; scheduler Bearer token |
| `PUBLIC_BASE_URL` | Public Railway/tunnel origin, without a trailing path |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token and webhook-signature secret |
| `TWILIO_WHATSAPP_FROM` | Sender such as `whatsapp:+14155238886` |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_MODEL` | Defaults to `claude-sonnet-4-6` |
| `AI_CONFIDENCE_THRESHOLD` | Clarification threshold, defaults to `0.65` |
| `USAGE_WINDOW_DAYS` | Rolling usage window, defaults to 30 |
| `REPORT_RETENTION_MINUTES` | WhatsApp report-link lifetime |
| `ALLOWED_ORIGINS` | Comma-separated browser origins |
| `TRUST_PROXY` | Express proxy hops, use `1` on Railway |

## Twilio Configuration

Set the WhatsApp incoming-message webhook to:

```text
POST https://YOUR_DOMAIN/webhook/whatsapp
```

Use `application/x-www-form-urlencoded`, Twilio's default. FactoryMind validates
`X-Twilio-Signature` using `PUBLIC_BASE_URL`, the full route/query, and all form
parameters. Do not put a reverse-proxy URL in `PUBLIC_BASE_URL` unless it is the
same URL Twilio calls.

Example messages:

```text
Morning update: Cement 120 bags, Steel Rod 12mm 850 kg
Shaam usage: cement 18 bags, saria 12mm 70 kg
How much cement is left?
Sab stock batao
Fastest supplier for packaging film
Send Excel report
```

Morning quantities are current stock snapshots. Evening quantities are consumed
amounts and cannot exceed the available balance.

## Inventory Rules

The ledger stores every change and has database triggers that reject update or
delete operations. Corrections must be appended as `ADJUSTMENT` entries with
notes.

Average daily usage is consumption in the rolling window divided by the active
calendar span in that window. Status is calculated as:

| Status | Rule |
| --- | --- |
| `GREEN` | More than 7 days, or no consumption history |
| `YELLOW` | More than 3 and at most 7 days |
| `RED` | Positive stock with at most 3 days |
| `BLACK` | Stock is zero |

The written requirements overlap at exactly 3 days; FactoryMind deliberately
uses `RED` at 3.0 days so the safer alert behavior wins.

An alert is queued when an item transitions into `RED`, and another critical
alert is queued if it subsequently becomes `BLACK`. The unique
stock-update/recipient/status key prevents duplicate alerts. Delivery workers
atomically claim rows with `FOR UPDATE SKIP LOCKED`; abandoned claims become
eligible again after ten minutes.

## API

All `/api` routes except expiring Excel downloads and the scheduler require:

```text
x-api-key: YOUR_API_KEY
```

The scheduler route requires:

```text
Authorization: Bearer YOUR_CRON_SECRET
```

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/webhook/whatsapp` | Twilio incoming-message webhook |
| `POST` | `/api/stock/update` | Record snapshot, consumption, or adjustment |
| `GET` | `/api/stock/current` | Current inventory and calculated status |
| `GET` | `/api/stock/history` | Filtered immutable stock history |
| `GET` | `/api/alerts/pending` | Pending/retryable low-stock alerts |
| `POST` | `/api/excel/generate` | Download a generated XLSX report |
| `GET` | `/api/dashboard` | Status totals, critical items, recent updates |
| `POST` | `/api/scheduler/morning-reminder` | Send reminder and retry alerts |
| `GET` | `/health` | Database-backed health check |

The full request/response contract is in
[`docs/openapi.yaml`](docs/openapi.yaml).

Example stock update:

```bash
curl -X POST https://YOUR_DOMAIN/api/stock/update \
  -H "content-type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "updateType": "CONSUMPTION",
    "entries": [
      { "materialName": "cement", "quantity": 12, "unit": "bags" }
    ]
  }'
```

## Railway Deployment

1. Push the repository to GitHub and create a Railway service from it.
2. Add every variable from `.env.example` in Railway. Set `PUBLIC_BASE_URL` to
   the generated/custom Railway HTTPS origin.
3. Deploy. Railway uses the included multi-stage `Dockerfile` and `/health`.
4. Run migrations and seed once from a trusted shell:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Configure Twilio with the deployed webhook URL.
6. Configure a Railway cron service or external scheduler to `POST`
   `/api/scheduler/morning-reminder` with the scheduler Bearer token.

For zero-downtime schema changes, add a new numbered SQL migration. Never edit a
migration after it has been applied; the runner verifies SHA-256 checksums.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run doctor
```

Tests do not call live Twilio, Anthropic, or Supabase services. Provider clients
are interfaces at service boundaries and can be replaced with fakes. `doctor`
requires real environment variables and a reachable database.

For the final live setup, follow
[`docs/go-live-checklist.md`](docs/go-live-checklist.md).

## Operations

- Logs are JSON and redact authorization, API-key, Twilio-signature, and phone
  fields.
- `requestId` is returned on API errors and propagated into audit events.
- Inbound Twilio `MessageSid` values are unique, preventing replayed updates.
- PostgreSQL row locks serialize stock writes per material.
- Generated report bytes expire and are deleted opportunistically.
- Back up Supabase and enable point-in-time recovery for production.
- Rotate API, scheduler, Twilio, and Anthropic secrets without committing `.env`.
- Alert rows stop retrying after five attempts; monitor `FAILED` rows.

## Vendor References

- [Anthropic model overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Twilio webhook security](https://www.twilio.com/docs/usage/security)
- [Railway configuration as code](https://docs.railway.com/config-as-code/reference)
- [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
