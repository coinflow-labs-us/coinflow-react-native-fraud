# Changelog

## 0.1.0

- Initial release of the unified Coinflow fraud-protection SDK for React Native.
- Bridges Coinflow's native iOS (`CoinflowFraud` pod) and Android (`cash.coinflow:coinflow-fraud`)
  fraud SDKs behind `initialize` + `getPurchaseHeaders`.
- Emits the single opaque `x-device-id` header (versioned base64url JSON), decoded server-side.
- Provider identities are never exposed on the public surface.
- Apps add no signal-SDK pods or credentialed Maven repos; the native SDKs bundle them.
