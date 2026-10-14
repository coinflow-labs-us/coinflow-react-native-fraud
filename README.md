# @coinflowlabs/react-native-fraud

Coinflow fraud protection for React Native. A thin bridge over Coinflow's native iOS and Android fraud
SDKs that returns a single opaque header to attach to Coinflow API calls.

## Install

```bash
npm install @coinflowlabs/react-native-fraud
```

## Usage

Wrap your app root so protection boots once:

```tsx
import {CoinflowProtectionProvider} from '@coinflowlabs/react-native-fraud';

export default function App() {
  return (
    <CoinflowProtectionProvider merchantId={merchantId} env="prod"> {/* 'prod' | 'sandbox' */}
      <RootNavigator />
    </CoinflowProtectionProvider>
  );
}
```

At charge time, attach the single opaque header:

```tsx
import {useCoinflowFraudHeaders} from '@coinflowlabs/react-native-fraud';

const getFraudHeaders = useCoinflowFraudHeaders();
const res = await fetch(chargeUrl, {headers: {...(await getFraudHeaders()), ...auth}});
// => {'x-device-id': '<opaque value>'}
```

Or imperatively via `CoinflowFraud.initialize({merchantId, env})` and
`CoinflowFraud.getPurchaseHeaders()`.

Changing `merchantId` or `env` on `CoinflowProtectionProvider` re-initializes with the new config.
When you call the API imperatively, switch config with
`CoinflowFraud.initialize({merchantId, env, force: true})`. A non-forced call with a different config
is ignored.

Neither call ever throws. When the native module isn't linked (Expo Go, web), `getPurchaseHeaders()`
returns `{}`.

### Native setup

The package autolinks a native module that wraps the native SDKs: the `CoinflowFraud` pod on iOS and
`cash.coinflow:coinflow-fraud` on Android.

- **Expo:** add `"@coinflowlabs/react-native-fraud"` to `plugins` in your app config. The plugin
  makes these changes:
  - It points your Podfile at the iOS SDK, which isn't on CocoaPods trunk.
  - It lifts the session provider's pods to iOS 15.1, because they declare 14.0, which current
    Xcode rejects.
  - On Android, it adds the signal SDKs' Maven repos to your app's `android/build.gradle`.
    `npx expo run:android` needs this because it builds with `--configure-on-demand`.
- **Bare React Native (iOS):** add this line to your Podfile target:
  ```ruby
  pod 'CoinflowFraud', :git => 'https://github.com/coinflow-labs-us/coinflow-swift-fraud.git', :tag => 'v0.2.0'
  ```
  Then add this at the top of your `post_install do |installer|` block:
  ```ruby
  installer.pods_project.targets.each do |target|
    next unless target.name.start_with?('VerisoulSDK')
    target.build_configurations.each do |build_config|
      build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
    end
  end
  ```
  iOS builds need Xcode 26 or later.
- **Android:** usually nothing to configure, because the module adds the signal SDKs' Maven repos
  itself. Apps that centralize repositories in `settings.gradle` through
  `dependencyResolutionManagement { repositoriesMode … }` are the exception. With
  `FAIL_ON_PROJECT_REPOS` the build fails, and with `PREFER_SETTINGS` the repos are ignored. Those
  apps add the repos listed in the
  [Android SDK README](https://github.com/coinflow-labs-us/coinflow/tree/main/lib/android-fraud#install-gradle)
  to `settings.gradle` themselves.

## Layout

- `src/` is the JS API, a fail-open wrapper around the native module.
- `ios/` is the Swift bridge to the `CoinflowFraud` pod (`lib/swift-fraud`).
- `android/` is the Kotlin bridge to `cash.coinflow:coinflow-fraud` (`lib/android-fraud`).
- `app.plugin.js` is the Expo config plugin. Inside the Coinflow monorepo, the testbench passes
  `{"localSdkRoot": "../../.."}`. With it, iOS builds the pod from `lib/swift-fraud` and Android
  resolves the SDK from `mavenLocal()`, so first run `./gradlew publishToMavenLocal` in
  `lib/android-fraud`.
