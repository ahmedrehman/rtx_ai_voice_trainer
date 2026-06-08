# Status Failed 0.8

Date: 2026-06-08

Branch: `codex_version_failed_0.8`

## Result

- 4 days spent for 3-4 core functionalities.
- Core functionalities are not reliable.
- App is not usable for real testing.
- Android/iOS audio behavior is not solved.
- Browser audio/listen/speak behavior is still unreliable.
- App can break or stop responding after 3-4 calls.
- Listen/speak/chat flow is not trustworthy enough.
- Debug and tests exposed problems but did not make the app reliable.

## Current Core Problems

- Mobile browser audio is unresolved.
- iOS/Android behavior needs real device testing and fixes.
- Voice recognition quality is poor.
- Listen mode can still behave unpredictably.
- Speak mode control has had repeated failures.
- App can keep talking or react when it should stay silent.
- Free chat and correction mode boundaries are still fragile.
- Keyword commands need strict handling as control only.
- The app flow needs stronger end-to-end testing before it can be called usable.

## Push Check

- `master` was pushed before this status branch.
- Latest pushed master commit before this branch: `beb886f Add voice agent command flow test`.
- This branch records the failed 0.8 state and status.

## Decision

- Do not treat this version as usable.
- Do not call this version reliable.
- Continue only with strict tests, exact expected outputs, and real device checks.
