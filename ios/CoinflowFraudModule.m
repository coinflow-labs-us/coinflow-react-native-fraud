#import <React/RCTBridgeModule.h>

// Exposed to JS as `CoinflowFraud`; the Swift class has its own name because the native SDK's module
// and main class are both called CoinflowFraud.
@interface RCT_EXTERN_REMAP_MODULE(CoinflowFraud, CoinflowFraudModule, NSObject)

RCT_EXTERN_METHOD(initialize:(NSString *)merchantId
                  env:(NSString *)env
                  force:(BOOL)force
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(purchaseHeaders:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
