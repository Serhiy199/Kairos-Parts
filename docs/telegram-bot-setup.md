# Telegram Bot Setup

## Bot

Bot username: `@kairos_parts_bot`

Bot URL: `https://t.me/kairos_parts_bot`

The bot was created manually through BotFather. Do not commit the real bot token or webhook secret.

## Required Environment Variables

Add these variables locally in `.env.local` and in Vercel Environment Variables:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=
APP_BASE_URL=
```

`APP_BASE_URL` is used to build public request status links, for example:

```text
https://kairos-parts.vercel.app
```

## Webhook Security

The webhook endpoint checks the Telegram secret token header:

```text
X-Telegram-Bot-Api-Secret-Token
```

Use the same value as `TELEGRAM_WEBHOOK_SECRET` when setting the Telegram webhook.

## Webhook URL

Production webhook URL:

```text
https://YOUR_DOMAIN/api/telegram/webhook
```

The same value can be stored as `TELEGRAM_WEBHOOK_URL`.

## Set Webhook

Use Telegram Bot API:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR_DOMAIN/api/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Do not paste real token or secret into committed files.

## Check Webhook

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

## Disable Webhook For Local Testing

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook"
```

## Database Migration

Day 10 adds `TelegramDraftRequest` for database-backed Telegram draft state. Apply the migration before enabling the webhook:

```bash
npx prisma migrate deploy
```

If the local machine cannot connect to Neon because of TLS issues, apply the SQL from:

```text
prisma/migrations/20260703141000_add_telegram_draft_requests/migration.sql
```

through Neon SQL editor or another trusted environment, then run:

```bash
npx prisma generate
```

## Storage Note

Telegram photo/document download is implemented through Telegram Bot API. Files are saved through the current local file storage helper. On Vercel this filesystem is ephemeral, so production-safe file persistence should move to object storage such as Vercel Blob/S3 before relying on long-term file downloads.
