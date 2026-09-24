# 05 - Mobile Student Ticket Wallet Architecture (React Native Expo)

## 1. Overview
The Student Ticket Wallet application provides attendees with offline access to their cryptographic event passes. It dynamically generates a 6-digit TOTP token every 30 seconds entirely on-device and renders an SVG vector QR code that defeats static screenshot fraud.

---

## 2. Technical Stack
* **Framework:** React Native Expo (TypeScript).
* **Cryptographic Engine:** `otpauth` (RFC 6238 standard).
* **Hardware Storage:** `expo-secure-store` (iOS Keychain / Android Keystore).
* **QR Renderer:** `react-native-qrcode-svg` (pure vector rendering avoiding native bitmap compression artifacts).

---

## 3. Dynamic QR Payload & Lifecycle

### 3.1 QR String Payload Structure
```
MSEUF:{ticket_id}:{totp_token}
Example: MSEUF:10492:839201
```

### 3.2 30-Second Refresh Cycle
1. `useTotpTicket` hook calculates remaining seconds until the next 30-second epoch step:
   $$\text{remaining} = 30 - (\text{Math.floor}(\text{Date.now}() / 1000) \pmod{30})$$
2. Computes the active 6-digit token using `otpauth.TOTP.generate()`.
3. Renders the QR vector code alongside a smooth visual circular progress bar indicating time until the token rotates.
4. When `remaining == 0`, generates the next token automatically without flickering or network calls.

---

## 4. Screenshot Invalidation Rationale
Because the student QR payload rotates every 30 seconds and scanners validate incoming tokens against the scanner's hardware clock within a strict window of $w = 1$, any screenshot shared via messaging apps becomes useless within seconds.
