import {faker} from '@faker-js/faker';
import {NativeModules} from 'react-native';
import {CoinflowFraud} from './CoinflowFraud';

jest.mock('react-native', () => ({NativeModules: {}}));

// Its own file: the "called before initialize" state is static, and jest gives each file a fresh module.
describe('CoinflowFraud before initialize', () => {
  const native = {
    initialize: async () => undefined,
    purchaseHeaders: async () => ({}) as Record<string, string>,
  };

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(native, 'purchaseHeaders').mockResolvedValue({});
    NativeModules.CoinflowFraud = native;
  });

  test('warns when a charge runs before initialize, and stops once it has run', async () => {
    await CoinflowFraud.getPurchaseHeaders();

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('before initialize()')
    );

    await CoinflowFraud.initialize({
      merchantId: faker.string.alphanumeric(12),
      env: 'sandbox',
    });
    await CoinflowFraud.getPurchaseHeaders();

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(native.purchaseHeaders).toHaveBeenCalledTimes(2);
  });
});
