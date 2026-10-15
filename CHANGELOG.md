# Changelog

## 0.1.1

- Pins the Android SDK to 0.1.1, which declares its appcompat dependency. React Native apps already
  include appcompat, so this only keeps the pinned versions in step.
- Expo plugin: vendor-neutral `post_install` deployment-target fix (the same block as the README).
- Android: the signal SDKs' Maven repos serve only their own groups, and the module declares no
  repositories when the app applies the `cash.coinflow.fraud.repositories` settings plugin, so
  `FAIL_ON_PROJECT_REPOS` builds work.

## 0.1.0

- Initial release of the unified Coinflow fraud-protection SDK for React Native.
- Bridges Coinflow's native iOS (`CoinflowFraud` pod) and Android (`cash.coinflow:coinflow-fraud`)
  fraud SDKs behind `initialize` + `getPurchaseHeaders`.
- Emits the single opaque `x-device-id` header (versioned base64url JSON), decoded server-side.
- Provider identities are never exposed on the public surface.
- Apps add no signal-SDK pods or credentialed Maven repos; the native SDKs bundle them.
