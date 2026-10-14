import {faker} from '@faker-js/faker';
import {NativeModules} from 'react-native';
import {CoinflowFraud} from './CoinflowFraud';

jest.mock('react-native', () => ({NativeModules: {}}));

// Its own file: the last initialized config is static, and jest gives each file a fresh module.
describe('CoinflowFraud.needsForce', () => {
  const merchantId = faker.string.alphanumeric(12);
  const otherMerchantId = faker.string.alphanumeric(13);
  const native = {
    initialize: async () => undefined,
    purchaseHeaders: async () => ({}) as Record<string, string>,
  };

  beforeAll(() => {
    NativeModules.CoinflowFraud = native;
  });

  test('is false before the first initialize', () => {
    expect(CoinflowFraud.needsForce({merchantId, env: 'prod'})).toBe(false);
  });

  describe('after initialize', () => {
    beforeAll(async () => {
      await CoinflowFraud.initialize({merchantId, env: 'prod'});
    });

    test('is false for the initialized config', () => {
      expect(CoinflowFraud.needsForce({merchantId, env: 'prod'})).toBe(false);
    });

    test('is true for a different merchantId', () => {
      expect(
        CoinflowFraud.needsForce({merchantId: otherMerchantId, env: 'prod'})
      ).toBe(true);
    });

    test('is true for a different env', () => {
      expect(CoinflowFraud.needsForce({merchantId, env: 'sandbox'})).toBe(true);
    });

    test('stays true after a non-forced initialize with a different config, which native ignores', async () => {
      await CoinflowFraud.initialize({
        merchantId: otherMerchantId,
        env: 'prod',
      });

      expect(
        CoinflowFraud.needsForce({merchantId: otherMerchantId, env: 'prod'})
      ).toBe(true);
      expect(CoinflowFraud.needsForce({merchantId, env: 'prod'})).toBe(false);
    });
  });
});
