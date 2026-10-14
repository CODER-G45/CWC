# CWC Daily Discharge (Render + Neon)

## 1. Database (Neon)
1. neon.tech → new project → copy the **connection string** (ends with `?sslmode=require`; the pooled one is fine).
2. Nothing else — the server creates the `entries` table on first start.

## 2. Deploy (Render)
1. Push this folder to a GitHub repo.
2. Render → New → Web Service (or Blueprint, it reads `render.yaml`) → pick the repo.
3. Build: `npm install` · Start: `npm start` · Plan: Free.
4. Environment variables:
   - `DATABASE_URL` = your Neon connection string
   - `CWC_TOKEN` = an access code you choose (required in practice — without it the URL is open to everyone)
5. Open the Render URL. On the first save the app asks for the access code once per browser.

## Run locally
`npm install` then `DATABASE_URL=... CWC_TOKEN=... node server.js` → http://localhost:3000

## Notes
- Render free: sleeps after 15 min idle, first open can take up to a minute. Data is safe (it lives in Neon).
- Neon free: compute pauses when idle; the first save after a pause can be a few seconds slower.
- Moving old data: open the app, **Import JSON** (exported files / backup bundle) — they go to the server.
- API: `GET /api/health`, `GET /api/entries?prefix=`, `GET|PUT|DELETE /api/entries/:key`.
