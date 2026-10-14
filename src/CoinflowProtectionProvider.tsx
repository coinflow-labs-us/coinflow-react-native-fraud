import React, {ReactNode, useEffect} from 'react';
import {CoinflowFraud, CoinflowFraudEnv} from './CoinflowFraud';

// Wrap the app root to boot protection on mount. A later merchantId/env change re-initializes with
// force, so the header always matches the current props.
export function CoinflowProtectionProvider({
  merchantId,
  env,
  children,
}: {
  merchantId: string;
  env: CoinflowFraudEnv;
  children?: ReactNode;
}) {
  useEffect(() => {
    const force = CoinflowFraud.needsForce({merchantId, env});
    void CoinflowFraud.initialize({merchantId, env, force});
  }, [merchantId, env]);

  return <>{children}</>;
}
