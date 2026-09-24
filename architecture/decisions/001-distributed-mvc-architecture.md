# ADR 001: Distributed Model-View-Controller (MVC) Architecture

## Status
Accepted

## Context
The midterm examination for Web & Mobile Combined mandates strict adherence to the Model-View-Controller (MVC) architectural pattern, weighted between 30% and 50% of the midterm grade. In typical offline-first systems, developers frequently leak business logic into the view layer (e.g. executing raw database queries or calculating cryptographic tokens inside mobile screen components), violating MVC principles and risking substantial grading penalties.

## Decision
We adopt a **Distributed MVC** architecture rather than a single monolithic pattern:
1. **Authoritative Server MVC (Laravel):** 
   - Model: Eloquent ORM + PostgreSQL on Supabase.
   - Controller: REST API Controllers routing via FormRequests and Domain Services.
   - View: Standardized JSON API Resources and React Admin SPA.
2. **Client Replica MVC (React Native Expo):**
   - Model: `expo-sqlite` (`local_manifest`, `pending_sync_queue`) and `expo-secure-store`.
   - Controller: Pure business logic services (`totpController`, `scannerController`, `syncController`).
   - View: Pure declarative React Native screens displaying HUD feedback and vector SVG QR codes.

## Consequences
- **Positive:** Guarantees zero business logic leakage into UI screens; satisfies academic MVC assessment criteria; allows complete offline autonomous gate validation.
- **Negative:** Requires strict discipline across two distinct models and coordination via opportunistic sync.
