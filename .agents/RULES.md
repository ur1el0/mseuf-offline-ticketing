# MSEUF Offline Ticketing - AI Coding Agent Rules & Reference Index

All development sessions and AI agents contributing to this repository must consult and strictly adhere to the technical standards defined across these documents:

* **System Architecture & Distributed MVC:** [ARCHITECTURE.md](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/ARCHITECTURE.md)
* **Product Requirements Document (PRD):** [PRD.md](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/PRD.md)
* **Cryptographic & Data Security Policy:** [SECURITY.md](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/SECURITY.md)
* **Engineering Phases & Milestones:** [PHASES.md](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/PHASES.md)
* **Master Task Backlog:** [backlog.md](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/backlog.md)
* **Domain & Cryptographic Glossary:** [GLOSSARY.md](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/GLOSSARY.md)
* **Operational Playbooks & Commands:** [SKILLS.md](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/SKILLS.md)
* **Troubleshooting & Diagnostics:** [TROUBLESHOOTING.md](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/TROUBLESHOOTING.md)

---

### Specific Technical Rules

* [`rules/01-architecture.md`](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/rules/01-architecture.md): Distributed MVC boundaries, layer isolation, and view logic segregation.
* [`rules/02-laravel-backend.md`](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/rules/02-laravel-backend.md): Eloquent models, FormRequests, Domain Services, and Supabase PostgreSQL Port 5432 pessimistic locking.
* [`rules/03-react-admin.md`](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/rules/03-react-admin.md): React, TypeScript, HTTP Polling interval strategy, and Tailwind styling.
* [`rules/04-testing.md`](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/rules/04-testing.md): Pest / PHPUnit and Jest TDD protocols, duplicate scan idempotency, and concurrency proofs.
* [`rules/05-git-workflow.md`](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/rules/05-git-workflow.md): Feature branching, atomic separated commits, conventional commit syntax, and PR formatting.
* [`rules/06-offline-sync-totp.md`](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/rules/06-offline-sync-totp.md): RFC 6238 TOTP token generation, UUID v4 idempotency keys, and chunked heartbeat sync.
* [`rules/07-expo-mobile.md`](file:///home/dokja/vsc-fedora/all/Projects/laravel-projects/mseuf-offline-ticketing/.agents/rules/07-expo-mobile.md): React Native Expo, `expo-sqlite` manifests, `expo-secure-store`, camera hook abstraction, and Marshal PIN workflow.
