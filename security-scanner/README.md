# EUEvent Security Scanner

Expo app for security staff. The current slice supports staff sign-in, per-device event-server configuration, and an assignment-scoped gate list. Ticket scanning, offline manifests, and scan synchronization are not enabled yet.

## Run on Fedora

1. From this directory, copy `.env.example` to `.env` if you want to set a build-time fallback URL. The app also has a **Change server** screen for the phone-specific address.
2. In `backend/`, run `php artisan serve --host 0.0.0.0`. Keep the development server on a trusted network.
3. In another terminal, from `security-scanner/`, run `npm start` and open the project in Expo Go or a development build.
4. On a physical phone, open **Change server** and enter `http://<FEDORA_LAN_IP>:8000/api/v1`. Use the Fedora computer's LAN IP; `localhost` and `.test` hostnames resolve on the phone itself and usually cannot reach Fedora.
5. Test the connection, save, and sign in with an account whose role is `security_staff`. The app will list only gates assigned to that account.

The API URL must include `/api/v1`. Changing servers clears the saved Sanctum session because each server issues its own token. The app stores the configured URL and session token in Expo SecureStore. Gate discovery returns metadata only; it does not request or persist ticket TOTP secrets. Local HTTP exposes credentials to other devices on the network, so use it only for a trusted demo network and test accounts. Use HTTPS for real user data and any deployment.
