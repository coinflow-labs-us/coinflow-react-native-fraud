package cash.coinflow.fraud.reactnative

import cash.coinflow.fraud.CoinflowFraud
import cash.coinflow.fraud.CoinflowFraudEnv
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

// Every promise settles on every path: JS awaits it in the charge path with no timeout of its own. The
// scope is never cancelled for the same reason; each SDK call is time-bounded.
class CoinflowFraudModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun getName() = "CoinflowFraud"

    @ReactMethod
    fun initialize(
        merchantId: String,
        env: String,
        force: Boolean,
        promise: Promise,
    ) {
        val sdkEnv = sdkEnv(env) ?: return promise.reject("invalid_env", "Unknown env: $env")
        // The launch Activity resumed long before this call, so hand it over directly.
        val context = reactApplicationContext.currentActivity ?: reactApplicationContext
        // JS's CoinflowFraud.needsForce assumes native applies initialize calls in JS call order. Main-looper
        // posts run FIFO, and on the main thread initialize's first suspension is the hop onto the engine's
        // serial queue, so calls reach the engine in that order.
        scope.launch(Dispatchers.Main) {
            runCatching {
                CoinflowFraud.initialize(context = context, merchantId = merchantId, env = sdkEnv, force = force)
            }
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun purchaseHeaders(promise: Promise) {
        scope.launch(Dispatchers.Main) {
            val headers = Arguments.createMap()
            runCatching { CoinflowFraud.purchaseHeaders() }
                .getOrDefault(emptyMap())
                .forEach { (name, value) -> headers.putString(name, value) }
            promise.resolve(headers)
        }
    }

    private fun sdkEnv(env: String): CoinflowFraudEnv? =
        when (env) {
            "prod" -> CoinflowFraudEnv.PROD
            "sandbox" -> CoinflowFraudEnv.SANDBOX
            else -> null
        }
}
