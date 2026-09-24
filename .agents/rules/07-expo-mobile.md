---
trigger: always_on
---

# Rule 07: React Native Expo Mobile Standards

These standards govern the mobile client architecture across Student and Scanner applications.

### 1. Model Layer: `expo-sqlite` & `expo-secure-store`
* **Rule:** Native database operations and keychain calls must be isolated in service abstractions.
* **Practice:**
  * Use `expo-sqlite` for structured local tables (`local_manifest`, `pending_sync_queue`). Never write raw SQLite queries inside UI components.
  * Use `expo-secure-store` exclusively for cryptographic ticket secrets and auth tokens.

### 2. Controller Layer: Custom Hooks & Service Handlers
* **Rule:** Screens must be pure declarative UI views.
* **Practice:**
  * Extract camera scanning and barcode evaluation into `useTicketScanner`.
  * Extract TOTP token calculation and timer updates into `useTotpTicket`.
  * Extract queue sync into `useSyncQueue`.

### 3. Scanner HUD & Feedback
* **Rule:** Scanner UI must provide unambiguous, instant visual feedback upon code capture.
* **Practice:**
  * Display high-contrast color badges: Green for Valid, Red for Invalid/Expired, Yellow for Wrong Gate.
  * Provide an accessible Marshal Override PIN modal for supervisor overrides.
