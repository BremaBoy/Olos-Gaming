Backend (Express) — README

Prerequisites
- Node.js >= 18
- npm or pnpm

Quick start
1. Copy environment example and fill values:
   cp .env.example .env
   # On Windows PowerShell:
   # copy .env.example .env

2. Install dependencies and run in dev mode:
   npm install
   npm run dev

3. Production start:
   npm run build # (none configured for backend; use `npm start` to run built code)
   npm start

Environment variables
- SUPABASE_URL: your Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY: Service Role Key (server-only). Keep this secret — do NOT expose it to the browser or client apps.
- PORT: server port (default 5000)
- NODE_ENV: development | production

Security notes
- The backend uses the Supabase Service Role key. Ensure you store it as a secret in your hosting platform (Render, Vercel environment, etc.) and never leak it in client-side bundles.
- Consider rotating the service role key and using scoped keys where possible.

Health & debugging
- Health check endpoint: GET /api/health
- Logs: the app prints simple request logs and errors to stdout/stderr.

Recommendations
- Add CI to run linters and basic checks.
- Add an `.env.example` at the repository root if multiple services share env vars.
- Add integration tests for auth flows and supabase RPCs.

