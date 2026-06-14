# FactoryMind Go-Live Checklist

Use this when real Supabase, Twilio, Anthropic, and Railway accounts are ready.

## 1. Production Secrets

Create Railway variables from `.env.example` and replace every placeholder:

- `DATABASE_URL`
- `DATABASE_SSL=true`
- `API_KEY`
- `CRON_SECRET`
- `PUBLIC_BASE_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `ALLOWED_ORIGINS`

Generate strong random values for `API_KEY` and `CRON_SECRET`; do not reuse
Twilio or Anthropic secrets.

## 2. Database

Run:

```bash
npm run db:migrate
npm run db:seed
```

Then update seed data in Supabase:

- Replace demo users with real factory owner, manager, and operator phone
  numbers in E.164 format.
- Replace demo materials with the real material master.
- Replace demo suppliers and supplier lead times with real vendors.

Run:

```bash
npm run doctor
```

The doctor command should show `OK` for database connection, migrations,
registered users, materials, and supplier links.

## 3. Railway

Deploy from the repository. Confirm:

- Build succeeds from the Dockerfile.
- Health check passes at `/health`.
- Railway logs show `FactoryMind is listening`.
- `npm audit --omit=dev` has zero known vulnerabilities.

## 4. Twilio WhatsApp

Configure the incoming WhatsApp webhook:

```text
POST https://YOUR_RAILWAY_DOMAIN/webhook/whatsapp
```

`PUBLIC_BASE_URL` must exactly match the scheme and host Twilio calls, otherwise
signature validation will reject messages.

## 5. Scheduler

Configure Railway cron or another trusted scheduler to call:

```text
POST https://YOUR_RAILWAY_DOMAIN/api/scheduler/morning-reminder
Authorization: Bearer YOUR_CRON_SECRET
```

## 6. Live Smoke Test

From a registered WhatsApp number, send:

```text
Morning update: Cement 120 bags
```

Then send:

```text
How much cement is left?
```

Then send:

```text
Send Excel report
```

Expected result:

- First message saves opening stock.
- Second message returns current stock and status.
- Third message returns an Excel file.
- `/api/stock/current` returns the same balance.

## 7. Alert Smoke Test

Create stock and then consume enough to enter RED:

```text
Morning update: Cement 10 bags
Evening usage: Cement 8 bags
```

Expected result:

- Owner receives a RED alert once.
- `/api/alerts/pending` does not repeatedly create duplicate alerts for the same
  stock update.
