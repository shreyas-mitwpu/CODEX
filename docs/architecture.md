# FactoryMind Architecture

## Boundaries

- `src/routes`: HTTP transport and response formatting
- `src/middleware`: authentication, webhook verification, validation, errors
- `src/services`: use cases and transaction orchestration
- `src/repositories`: parameterized SQL and row mapping
- `src/ai`: Claude extraction and deterministic fallback
- `src/integrations`: Twilio adapter
- `src/domain`: provider-independent types
- `src/utils`: pure normalization and calculation functions

Services depend on adapter interfaces where outbound behavior is involved. The
database is accessed only through repositories, and multi-record writes are
owned by services using `withTransaction`.

## Data Model

`materials` is the canonical material master, including aliases and canonical
units. `stock_updates` is an append-only ledger. Each row stores the operation,
the quantity, before/after balances, effective time, user, source, and optional
inbound event.

`users` controls WhatsApp access and alert recipients. `suppliers` and
`supplier_materials` model the many-to-many catalog with material-specific lead
times. `alerts_sent` is both the alert history and delivery state machine.

`inbound_events` provides webhook idempotency. `audit_events` captures
operational actions independently from inventory. `generated_reports` provides
short-lived database-backed media downloads that survive across Railway
instances.

## Stock Transaction

1. Resolve all names against active material names and aliases.
2. Reject unknown or duplicate materials.
3. Start a PostgreSQL transaction.
4. Lock the material master row, serializing writes for that material.
5. Read the latest ledger balance with a row lock.
6. Convert the incoming quantity to the canonical unit.
7. Reject consumption greater than available stock.
8. Append the stock row and audit event.
9. Calculate the post-write rolling consumption rate.
10. If the item newly enters RED or BLACK, queue one alert per active owner with
    the fastest supplier.
11. Commit.
12. Claim and deliver pending alerts outside the stock transaction.

This split means provider downtime cannot undo a valid inventory update.

## Idempotency

Twilio `MessageSid` is unique in `inbound_events`. An event must atomically move
from `RECEIVED` or `FAILED` to `PROCESSING` before any work. A concurrent retry
cannot claim it. Each stock line is also unique by inbound event and line index.

Alert uniqueness is enforced by stock update, recipient, and status. Delivery
claims use `PROCESSING` plus `FOR UPDATE SKIP LOCKED`; stale claims can be
reclaimed.

## AI Safety

Claude receives only the active material catalog and must select canonical names.
Its response is parsed as JSON and validated with Zod. Unsupported units,
negative quantities, unknown materials, and low-confidence messages are rejected
or clarified before database writes.

If Claude is unavailable or emits invalid output, the deterministic parser
supports common English/Hinglish keywords, material aliases, and inventory unit
abbreviations. It is intentionally conservative and never creates material
masters or invents quantities.

## Security

- Twilio webhook signatures are validated against the exact public URL.
- Internal API and scheduler credentials use timing-safe comparison.
- All inputs have size limits and Zod schemas.
- SQL values are parameterized.
- Helmet, CORS, rate limiting, and body limits are enabled.
- Logs redact credentials and phone-number fields.
- Report links use 256-bit random tokens stored only as SHA-256 hashes.
- Inventory and audit tables reject updates and deletes at the database layer.

## Scaling

The application is stateless except for PostgreSQL. It can run multiple Railway
replicas because webhook claims, stock locks, report content, and alert claims
are database-backed. PostgreSQL pool size is capped per process; adjust it
against the Supabase pooler limit before increasing replicas.

For sustained webhook volume, the next scaling step is a durable queue/outbox
worker. The current synchronous webhook is appropriate for moderate factory
traffic and preserves Twilio retry semantics for unexpected failures.
