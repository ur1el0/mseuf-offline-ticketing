# EUEvent presentation guide

This folder is the shared speaker and demonstration guide for the current EUEvent build. It is written against the repository’s current `main` implementation. Use it to prepare a live walkthrough, explain the architecture in a defense, and describe a realistic next development milestone.

## Read in this order

1. [Live demo run of show](01-live-demo-run-of-show.md) — preparation, timing, actions, expected results, and recovery when a demo dependency fails.
2. [How the system works](02-how-the-system-works.md) — the end-to-end flow and what each application and Laravel layer is responsible for.
3. [The next half of the project](03-remaining-project-roadmap.md) — a proposed, prioritized roadmap with completion evidence for each phase.
4. [Presenter explanation notes](04-presenter-explanation-notes.md) — plain-language narration and defensible answers to likely questions.

## Accuracy rule

The word “half” is a planning label, not a verified project-completion score. A percentage depends on the course rubric and on whether it measures screens, requirements, tests, or production readiness. These guides separate current behavior from known limits and proposed work. Confirm the current branch and app build before presenting; a design, roadmap item, test, or private note is not proof that a deployed demo has been exercised end to end.

## Related technical references

- [Repository overview and local presentation setup](../../README.md)
- [System architecture guide](../architecture.md)
- [API contract](../api.md)
- [Accepted design decisions](../design-decisions.md)
- [Offline cryptography and synchronization](../../architecture/08-cryptographic-and-offline-sync-engine.md)
- [Gate partitioning and known offline conflicts](../../architecture/09-gate-partitioning-and-marshal-override.md)
- [Backend presentation database instructions](../../backend/README.md#local-presentation-mode)
- [Mobile scanner run instructions](../../security-scanner/README.md)
