# EUEvent administrator dashboard

The desktop React and TypeScript dashboard uses the Laravel API for administrator workflows. It supports student and security-staff account creation, venue and physical gate setup, event scheduling and lifecycle changes, event gate/staff assignment, ticket issuance, operational metrics, and activity-log review.

The dashboard keeps the Sanctum bearer token in memory. Reloading the page clears the session and requires another sign-in. Metrics refresh every 10 seconds and retain the last successful result during brief network failures.

## Run locally with Lerd

1. From `admin-web/`, create the local environment file:

   ```bash
   cp .env.example .env
   ```

2. Set `VITE_BACKEND_ORIGIN` to the Laravel host. Use `https://backend.test` for a linked Lerd site. For the isolated presentation API, use `http://127.0.0.1:8002`.
3. Install dependencies and start Vite:

   ```bash
   npm install
   npm run dev -- --host 0.0.0.0
   ```

4. Open the Vite address shown in the terminal and sign in with an administrator account.

The Vite development server proxies `/api/*` to `VITE_BACKEND_ORIGIN`; `VITE_API_BASE_URL` defaults to `/api/v1`. For local presentation setup, see [the backend README](../backend/README.md#local-presentation-mode).

## Build

```bash
npm run build
```

The production API base should be configured for the deployed environment. Use HTTPS when sending real user credentials or ticket data.
