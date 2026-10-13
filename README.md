# Active Ballers

Weekly paid-players list. Static site + Netlify Functions + Netlify Blobs (all free tier, no card).

- `GET /api/list?week=YYYY-MM-DD` – players for a week (default current). Weeks start Saturday 00:00 Lagos time.
- `POST /api/webhook?token=SECRET` – called by the payment provider.

## Deploy
1. Push this folder to its own GitHub repo.
2. Netlify → Add new site → Import from GitHub (free plan).
3. Site settings → Environment variables: `WEBHOOK_SECRET` = any long random string.
4. Webhook URL to give your payment provider: `https://<site>.netlify.app/api/webhook?token=<WEBHOOK_SECRET>`
5. Put the payment link in `public/config.js`.

## Local
`npm install && npx netlify dev`
