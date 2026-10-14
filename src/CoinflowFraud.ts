import {NativeModules} from 'react-native';

export type CoinflowFraudEnv = 'prod' | 'sandbox';

export const PROTECTION_HEADER = 'x-device-id';

export interface CoinflowFraudConfig {
  merchantId: string;
  env: CoinflowFraudEnv;
  // Start over with a different merchant or env.
  force?: boolean;
}

export type CoinflowFraudHeaders = Partial<
  Record<typeof PROTECTION_HEADER, string>
>;

interface CoinflowFraudNativeModule {
  initialize(
    merchantId: string,
    env: CoinflowFraudEnv,
    force: boolean
  ): Promise<void>;
  purchaseHeaders(): Promise<Record<string, string>>;
}

// Coinflow fraud protection for React Native, backed by the native iOS and Android SDKs. Call
// `initialize` once (or mount CoinflowProtectionProvider), then `getPurchaseHeaders()` at charge time.
// Fail-open: neither call ever throws into the merchant app.
export class CoinflowFraud {
  private static initializeCalled = false;
  private static lastConfig: Pick<
    CoinflowFraudConfig,
    'merchantId' | 'env'
  > | null = null;

  static async initialize({
    merchantId,
    env,
    force = false,
  }: CoinflowFraudConfig): Promise<void> {
    this.initializeCalled = true;
    // Native keeps the first config and ignores a non-forced call with a different one.
    if (force || !this.lastConfig) this.lastConfig = {merchantId, env};
    const native = this.nativeModule();
    if (!native) return;
    await native.initialize(merchantId, env, force).catch(() => undefined);
  }

  // The native SDK ignores a non-forced initialize with a different config, so a caller switching
  // merchant or env must pass force.
  static needsForce({
    merchantId,
    env,
  }: Pick<CoinflowFraudConfig, 'merchantId' | 'env'>): boolean {
    if (!this.lastConfig) return false;
    return (
      this.lastConfig.merchantId !== merchantId || this.lastConfig.env !== env
    );
  }

  static async getPurchaseHeaders(): Promise<CoinflowFraudHeaders> {
    if (!this.initializeCalled)
      console.warn(
        'CoinflowFraud.getPurchaseHeaders() called before initialize(); the header will be empty.'
      );
    const native = this.nativeModule();
    if (!native) return {};

    const headers = await native.purchaseHeaders().catch(() => null);
    const value = headers?.[PROTECTION_HEADER];
    return value ? {[PROTECTION_HEADER]: value} : {};
  }

  // Undefined when the native module isn't linked (e.g. Expo Go or web).
  private static nativeModule(): CoinflowFraudNativeModule | undefined {
    return NativeModules.CoinflowFraud;
  }
}
