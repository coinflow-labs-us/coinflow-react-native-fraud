import {useCallback} from 'react';
import {CoinflowFraud, CoinflowFraudHeaders} from './CoinflowFraud';

export function useCoinflowFraudHeaders(): () => Promise<CoinflowFraudHeaders> {
  return useCallback(() => CoinflowFraud.getPurchaseHeaders(), []);
}
