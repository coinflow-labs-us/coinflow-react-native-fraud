import {faker} from '@faker-js/faker';
import {NativeModules} from 'react-native';
import {CoinflowFraud, PROTECTION_HEADER} from './CoinflowFraud';

jest.mock('react-native', () => ({NativeModules: {}}));

describe('CoinflowFraud', () => {
  const merchantId = faker.string.alphanumeric(12);
  const env = faker.helpers.arrayElement(['prod', 'sandbox'] as const);
  const native = {
    initialize: async () => undefined,
    purchaseHeaders: async () => ({}) as Record<string, string>,
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    NativeModules.CoinflowFraud = native;
  });

  describe('initialize', () => {
    test('forwards the merchant and env to the native SDK, without force by default', async () => {
      jest.spyOn(native, 'initialize').mockResolvedValue(undefined);

      await CoinflowFraud.initialize({merchantId, env});

      expect(native.initialize).toHaveBeenCalledTimes(1);
      expect(native.initialize).toHaveBeenCalledWith(merchantId, env, false);
    });

    test('forwards force to start over with a new config', async () => {
      jest.spyOn(native, 'initialize').mockResolvedValue(undefined);

      await CoinflowFraud.initialize({merchantId, env, force: true});

      expect(native.initialize).toHaveBeenCalledTimes(1);
      expect(native.initialize).toHaveBeenCalledWith(merchantId, env, true);
    });

    test('swallows a native rejection', async () => {
      jest
        .spyOn(native, 'initialize')
        .mockRejectedValue(new Error(faker.lorem.sentence()));

      await expect(
        CoinflowFraud.initialize({merchantId, env})
      ).resolves.toBeUndefined();
      expect(native.initialize).toHaveBeenCalledTimes(1);
    });

    test('is a no-op when the native module is not linked', async () => {
      jest.spyOn(native, 'initialize');
      NativeModules.CoinflowFraud = undefined;

      await expect(
        CoinflowFraud.initialize({merchantId, env})
      ).resolves.toBeUndefined();
      expect(native.initialize).not.toHaveBeenCalled();
    });
  });

  describe('getPurchaseHeaders', () => {
    test('returns the native header', async () => {
      const header = faker.string.alphanumeric(64);
      jest
        .spyOn(native, 'purchaseHeaders')
        .mockResolvedValue({[PROTECTION_HEADER]: header});

      await CoinflowFraud.initialize({merchantId, env});

      expect(await CoinflowFraud.getPurchaseHeaders()).toEqual({
        [PROTECTION_HEADER]: header,
      });
      expect(native.purchaseHeaders).toHaveBeenCalledTimes(1);
      expect(native.purchaseHeaders).toHaveBeenCalledWith();
    });

    test('passes through only the protection header', async () => {
      const header = faker.string.alphanumeric(64);
      jest.spyOn(native, 'purchaseHeaders').mockResolvedValue({
        [PROTECTION_HEADER]: header,
        [faker.string.alpha(10)]: faker.string.alphanumeric(10),
      });

      expect(await CoinflowFraud.getPurchaseHeaders()).toEqual({
        [PROTECTION_HEADER]: header,
      });
    });

    test('returns {} when no token was available', async () => {
      jest.spyOn(native, 'purchaseHeaders').mockResolvedValue({});

      expect(await CoinflowFraud.getPurchaseHeaders()).toEqual({});
      expect(native.purchaseHeaders).toHaveBeenCalledTimes(1);
    });

    test('returns {} when the native call rejects', async () => {
      jest
        .spyOn(native, 'purchaseHeaders')
        .mockRejectedValue(new Error(faker.lorem.sentence()));

      expect(await CoinflowFraud.getPurchaseHeaders()).toEqual({});
      expect(native.purchaseHeaders).toHaveBeenCalledTimes(1);
    });

    test('returns {} when the native module is not linked', async () => {
      jest.spyOn(native, 'purchaseHeaders');
      NativeModules.CoinflowFraud = undefined;

      expect(await CoinflowFraud.getPurchaseHeaders()).toEqual({});
      expect(native.purchaseHeaders).not.toHaveBeenCalled();
    });
  });
});
