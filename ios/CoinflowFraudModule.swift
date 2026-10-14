import CoinflowFraud
import Foundation

@objc(CoinflowFraudModule)
final class CoinflowFraudModule: NSObject {
    @objc static func requiresMainQueueSetup() -> Bool { false }

    @objc(initialize:env:force:resolve:reject:)
    func initialize(
        _ merchantId: String,
        env: String,
        force: Bool,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let sdkEnv = CoinflowFraudEnv(rawValue: env) else {
            reject("invalid_env", "Unknown env: \(env)", nil)
            return
        }
        Task { @MainActor in
            await CoinflowFraud.shared.initialize(merchantId: merchantId, env: sdkEnv, force: force)
            resolve(nil)
        }
    }

    @objc(purchaseHeaders:reject:)
    func purchaseHeaders(
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        Task { @MainActor in
            resolve(await CoinflowFraud.shared.purchaseHeaders())
        }
    }
}
