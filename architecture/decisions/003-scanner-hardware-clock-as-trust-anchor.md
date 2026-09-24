# ADR 003: Scanner Hardware Clock as Sole Cryptographic Trust Anchor

## Status
Accepted

## Context
If ticket verification relies on the attendee device's clock, malicious attendees can tamper with their smartphone operating system time (e.g., rolling back the clock to re-generate an earlier token or pausing the clock to keep a captured screenshot valid).

## Decision
We establish the **physical scanner device's hardware clock as the sole cryptographic trust anchor**:
1. Client attendee clocks are completely untrusted.
2. When a token is optically scanned, the scanner evaluates the token strictly against its own local clock.
3. The evaluation permits a tolerance of $w = 1$ step ($\pm 30$ seconds) to absorb non-malicious drift while rejecting expired tokens.

## Consequences
- **Positive:** Attendees cannot bypass admission control by rolling back or altering their smartphone clocks.
- **Negative:** Scanner hardware devices must have accurately synchronized clocks (via NTP) prior to gate opening.
