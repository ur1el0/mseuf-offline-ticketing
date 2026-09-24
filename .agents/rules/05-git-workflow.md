---
trigger: always_on
---

# Rule 05: Version Control & Git Strategy Standards

These standards govern branch hygiene, commit atomicity, and pull request management.

### 1. Feature Branching Protocol (Never Push Directly to Main)
* **Rule:** All development must occur on dedicated, scoped feature branches (e.g. `feature/ticket-totp-engine`, `feature/sqlite-sync-queue`, `feature/pessimistic-locking`).
* **Branch Declaration:** The active branch must be declared and confirmed before code modifications begin.

### 2. Atomic, Separated Commits (Strict Separation)
* **Rule:** Never combine changes across disparate architectural layers into a single commit.
* **Practice:** Always provide separate `git add` and `git commit` commands for:
  1. Migrations & Database Schemas.
  2. Models, Services, or Repositories.
  3. Controllers or API Endpoints.
  4. UI Components / Views.
  5. Automated Tests.

### 3. Conventional Commit Formatting
* **Format:** `<type>: <concise description>`
* **Types:**
  * `feat:` New feature or capability.
  * `fix:` Bug fix or error resolution.
  * `refactor:` Code restructuring without functional change.
  * `test:` Adding or updating tests.
  * `chore:` Configuration, dependencies, or documentation.

### 4. Secret Safety
* **Rule:** Never commit `.env` files, Supabase keys, SQLite database files, or private agent instructor notes. Keep `.gitignore` strictly enforced.
