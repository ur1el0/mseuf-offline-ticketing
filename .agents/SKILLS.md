# MSEUF Offline Ticketing - Operational Playbooks & Engineering Commands

This document contains standard commands, development workflows, and operational playbooks across the MSEUF Offline Ticketing ecosystem (Laravel, React, Expo React Native, and PostgreSQL).

---

## 1. Development Workflows

### 1.1 Authoritative Server MVC (Laravel Backend)

* **Start Backend Server:**
  ```bash
  php artisan serve
  ```

* **Execute Database Migrations:**
  ```bash
  php artisan migrate
  ```

* **Seed Initial MSEUF Event Data (Gates, Students, Tickets):**
  ```bash
  php artisan db:seed
  ```

* **Run Backend Unit & Feature Tests:**
  ```bash
  php artisan test
  # or using Pest directly:
  ./vendor/bin/pest
  ```

* **Verify API Route Registry:**
  ```bash
  php artisan route:list --path=api
  ```

---

### 1.2 Web Admin Dashboard (React + TypeScript)

* **Start Local Development Server:**
  ```bash
  cd web-admin
  npm run dev
  ```

* **Run TypeScript Type Check & Production Build:**
  ```bash
  cd web-admin
  npm run build
  ```

* **Execute Component Tests:**
  ```bash
  cd web-admin
  npm run test
  ```

---

### 1.3 Mobile Client Replica (React Native Expo)

* **Start Expo Development Server:**
  ```bash
  cd mobile
  npx expo start
  ```

* **Run on Connected Physical Device (Android via ADB):**
  ```bash
  # Check connected hardware:
  adb devices

  # Reverse port for local Laravel API access:
  adb reverse tcp:8000 tcp:8000

  # Launch Expo app:
  cd mobile
  npx expo run:android
  ```

* **Run Mobile Unit Tests (Jest):**
  ```bash
  cd mobile
  npm test
  ```

* **TypeScript & Linter Validation:**
  ```bash
  cd mobile
  npx tsc --noEmit
  npm run lint
  ```

---

## 2. Pre-Push Verification Checklist

Always run the unified verification matrix before pushing a feature branch:
1. **Backend Tests:** `php artisan test` (100% passing, testing ticket issuance, idempotency, and concurrency).
2. **Frontend Build:** `cd web-admin && npm run build` (No TypeScript or bundling errors).
3. **Mobile Tests & Types:** `cd mobile && npm test && npx tsc --noEmit` (Zero static analysis warnings).
4. **Git Hygiene:** `git status` confirms `.env`, SQLite databases, and personal agent files remain untracked.
