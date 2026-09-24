# ADR 007: Adoption of `expo-sqlite` over Native C++ SQLite Bridges

## Status
Accepted

## Context
Mobile SQLite implementations in React Native often involve third-party libraries (e.g., `react-native-sqlite-storage`, `op-sqlite`) that require complex native C++ builds, custom Android NDK setups, or prebuild ejection. In multi-developer student environments or presentation setups, native compilation discrepancies frequently cause build crashes.

## Decision
We mandate **`expo-sqlite`** as the client-side Model engine:
1. Native integration within the Expo ecosystem without manual NDK orchestration.
2. Fast, synchronous/asynchronous SQLite query execution supporting indexes and parameterized statements.
3. Clean cross-platform compatibility across both Android and iOS devices.

## Consequences
- **Positive:** Painless setup; zero C++ compilation friction; high reliability across student devices.
- **Negative:** Slightly fewer niche SQLite extension modules compared to hand-compiled C++ binaries, none of which are needed for manifest lookups.
