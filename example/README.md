# @coinflowlabs/react-native-fraud example

A minimal Expo app that boots Coinflow fraud protection and attaches the `x-device-id` header to an
outgoing request. It installs the published package from npm, the same way a merchant would.

## Run

```bash
cp example.env .env   # optional prefills
npm install
npx expo run:ios      # or: npx expo run:android
```

The header needs the native module, so use a dev build (`expo run:*`). In Expo Go,
`getPurchaseHeaders()` returns `{}` and the app shows an empty header.

## What it shows

- Enter your **Merchant ID** first. `App.tsx` wraps the screen in `CoinflowProtectionProvider` with it,
  which initializes protection, and re-initializes it if you change the ID.
- **Get x-device-id header** calls `useCoinflowFraudHeaders()` and merges the result into the
  request headers.
- **Send request** appears when `EXPO_PUBLIC_CHARGE_URL` is set. It POSTs to that URL with the
  headers and shows the response.
- **Card checkout** renders `CoinflowCardForm` from `@coinflowlabs/react-native` for that merchant.
  Paste a **Session key** (a customer session key your backend gets from `GET /api/auth/session-key`
  with your API key), and **Pay** tokenizes the card and calls `POST /api/checkout/card/{merchantId}`
  with `x-device-id` attached.
- With `EXPO_PUBLIC_COINFLOW_FRAUD_AUTORUN=1` and `EXPO_PUBLIC_COINFLOW_MERCHANT_ID` set, the app
  collects the headers 5s after launch and logs `COINFLOW_FRAUD_RESULT` to the Metro console, for
  scripted runs.

```tsx
const getFraudHeaders = useCoinflowFraudHeaders();
await fetch(chargeUrl, {headers: {...(await getFraudHeaders()), ...auth}});
// => {'x-device-id': '<opaque value>'}
```
