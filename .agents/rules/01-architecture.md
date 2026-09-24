---
trigger: always_on
---

# Rule 01: Distributed MVC Architecture Standards

These standards govern architectural separation between the authoritative Laravel server and the offline mobile client replicas.

### 1. Strict MVC Layer Purity (No Logic in Views)
* **Rule:** Presentation components (React Admin pages, React Native screens) must NEVER execute database queries, calculate cryptographic HMAC tokens, or parse synchronization queues directly.
* **Practice:**
  * In React Native: Screens (`ScannerScreen`, `StudentTicketScreen`) must only invoke custom hooks (`useTicketScanner`, `useTotpTicket`). All SQLite execution and TOTP math are isolated in `services/databaseService.ts` and `services/totpService.ts`.
  * In React Web Admin: Pages render data provided by React hooks backed by pure HTTP fetch/polling abstractions.

### 2. Backend Controller Decoupling (Domain Services)
* **Rule:** Laravel Controllers must remain thin (under 150 lines). Never write raw SQL, direct encryption calls, or sync loop orchestration directly inside a Controller.
* **Practice:** Route HTTP requests through dedicated FormRequests, dispatch logic to Domain Services (`SyncReconciliationService`, `TicketVerificationService`), and return standardized Eloquent API Resources (`TicketResource`, `ScanLogResource`).

### 3. Server Authoritative Role
* **Rule:** The central Laravel server is the sole authoritative arbiter of state.
* **Practice:** Client device clocks are treated as unverified. In any reconciliation conflict or race condition, `server_received_at` is the authoritative tie-breaker.

### 4. No God Files
* **Rule:** Files must not exceed 250 lines.
* **Practice:** If a service or hook exceeds 250 lines, decompose it into single-responsibility actions or sub-services.
