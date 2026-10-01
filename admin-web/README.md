# EUEvent administrator dashboard

This React + TypeScript client uses the Laravel API for administrator sign-in and live operational metrics. It does not persist bearer tokens in browser storage; a refresh returns to the sign-in screen. Metrics refresh every 10 seconds, and the last successful response remains visible through brief network failures.

## Local setup with Lerd

1. In `admin-web`, copy `.env.example` to `.env`.
2. Confirm `VITE_BACKEND_ORIGIN` points to the Lerd URL for Laravel (default `https://backend.test`).
3. Run `npm install` and then `npm run dev`.
4. Open the Vite URL and sign in with an administrator account.

The dev server proxies `/api/*` to Laravel, avoiding a browser CORS change for local development. In production, set `VITE_API_BASE_URL` to the deployment's API path or origin and serve the API through the same trusted host.

Event setup, gate assignments, complete audit-log browsing, and scanner heartbeat data are not connected yet because the backend does not expose those endpoints. The dashboard labels missing telemetry as unavailable instead of showing a misleading zero.
