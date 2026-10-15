import {useCallback, useEffect, useRef, useState} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {StatusBar} from 'expo-status-bar';
import {
  CoinflowCardForm,
  type CardFormNativeRef,
} from '@coinflowlabs/react-native';
import {
  CoinflowProtectionProvider,
  PROTECTION_HEADER,
  useCoinflowFraudHeaders,
  type CoinflowFraudEnv,
} from '@coinflowlabs/react-native-fraud';

// Optional prefills for the inputs below.
const DEFAULT_MERCHANT_ID = process.env.EXPO_PUBLIC_COINFLOW_MERCHANT_ID ?? '';
const ENV: CoinflowFraudEnv =
  process.env.EXPO_PUBLIC_COINFLOW_ENV === 'prod' ? 'prod' : 'sandbox';
const CHARGE_URL = process.env.EXPO_PUBLIC_CHARGE_URL;
// For scripted runs: collect once after launch and log the headers.
const AUTORUN = process.env.EXPO_PUBLIC_COINFLOW_FRAUD_AUTORUN === '1';
// Gives the provider's initialize time to start the native signal SDKs.
const AUTORUN_DELAY_MS = 5000;
// Longer than Android's keyboard hide animation, so a blur that dismissed the keyboard isn't taken for
// focus moving to another input.
const FOCUS_MOVE_CHECK_MS = 400;

// A customer session key from GET /api/auth/session-key, which your backend fetches with your API key.
// The app never holds the API key itself.
const DEFAULT_SESSION_KEY = process.env.EXPO_PUBLIC_COINFLOW_SESSION_KEY ?? '';
const API_URL =
  ENV === 'prod'
    ? 'https://api.coinflow.cash/api'
    : 'https://api-sandbox.coinflow.cash/api';
const SUBTOTAL_CENTS = 500;
// What the customer is buying. Required when chargeback protection is enabled for the merchant.
// Use the productType Coinflow gives you for your products.
const SAMPLE_CHARGEBACK_PROTECTION_DATA = [
  {
    productName: 'Sample item',
    productType: 'inGameProduct',
    sellingPrice: {valueInCurrency: SUBTOTAL_CENTS / 100, currency: 'USD'},
    quantity: 1,
  },
];
// Sample customer details for the demo; a real checkout collects these from the customer.
const SAMPLE_CUSTOMER = {
  email: 'customer@example.com',
  firstName: 'Sample',
  lastName: 'Customer',
  address1: '123 Main St',
  city: 'Chicago',
  state: 'IL',
  zip: '60601',
  country: 'US',
};

export default function App() {
  const [merchantId, setMerchantId] = useState(DEFAULT_MERCHANT_ID);

  return (
    <SafeAreaProvider>
      {/* Protection starts once there's a merchant ID. A sibling rather than a wrapper, so entering or
          clearing the ID doesn't remount the screen and lose what's been typed. */}
      {merchantId ? (
        <CoinflowProtectionProvider merchantId={merchantId} env={ENV} />
      ) : null}
      <CheckoutScreen
        merchantId={merchantId}
        onMerchantIdChange={setMerchantId}
      />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

function CheckoutScreen({
  merchantId,
  onMerchantIdChange,
}: {
  merchantId: string;
  onMerchantIdChange: (merchantId: string) => void;
}) {
  const getFraudHeaders = useCoinflowFraudHeaders();
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [merchantDraft, setMerchantDraft] = useState(merchantId);
  const scrollRef = useRef<ScrollView>(null);
  const cardSectionY = useRef(0);
  const merchantFocused = useRef(false);
  // Set when a checkout result arrives; scrolls to it once it has rendered.
  const scrollToResult = useRef(false);

  // The card form's inputs live in a WebView, so the ScrollView can't tell which one has focus. Bring
  // the whole card section above the keyboard instead.
  const scrollToCardSection = useCallback(() => {
    scrollRef.current?.scrollTo({y: cardSectionY.current, animated: true});
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      if (merchantFocused.current) return;
      scrollToCardSection();
    });
    return () => subscription.remove();
  }, [scrollToCardSection]);

  // Android sends no keyboardDidShow when focus moves to another input while the keyboard is already up.
  const onMerchantBlur = () => {
    merchantFocused.current = false;
    if (Platform.OS !== 'android') return;
    setTimeout(() => {
      if (Keyboard.isVisible() && !merchantFocused.current)
        scrollToCardSection();
    }, FOCUS_MOVE_CHECK_MS);
  };

  const buildRequestHeaders = useCallback(
    async () => ({
      'Content-Type': 'application/json',
      ...(await getFraudHeaders()),
    }),
    [getFraudHeaders]
  );

  const onBuild = async () => {
    setBusy(true);
    try {
      setHeaders(await buildRequestHeaders());
      setResponse(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!AUTORUN || !merchantId) return;
    const timer = setTimeout(async () => {
      const requestHeaders = await buildRequestHeaders();
      setHeaders(requestHeaders);
      console.log('COINFLOW_FRAUD_RESULT', JSON.stringify(requestHeaders));
    }, AUTORUN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [buildRequestHeaders, merchantId]);

  const onSend = async () => {
    if (!CHARGE_URL) return;
    setBusy(true);
    try {
      const requestHeaders = await buildRequestHeaders();
      setHeaders(requestHeaders);
      const res = await fetch(CHARGE_URL, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({}),
      });
      setResponse(`${res.status} ${res.statusText}\n${await res.text()}`);
    } catch (e) {
      setResponse(String(e));
    } finally {
      setBusy(false);
    }
  };

  const deviceId = headers?.[PROTECTION_HEADER];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!scrollToResult.current) return;
            scrollToResult.current = false;
            scrollRef.current?.scrollToEnd({animated: true});
          }}
        >
          <Text style={styles.title}>Coinflow Fraud Example</Text>
          <Text style={styles.subtitle}>
            env <Text style={styles.code}>{ENV}</Text>
          </Text>

          {/* Applied when editing ends: each change re-initializes fraud protection. */}
          <Field
            label="Merchant ID"
            value={merchantDraft}
            onChangeText={setMerchantDraft}
            onEndEditing={() => onMerchantIdChange(merchantDraft.trim())}
            onFocus={() => (merchantFocused.current = true)}
            onBlur={onMerchantBlur}
            placeholder="your-merchant-id"
          />

          <Button
            label={busy ? 'Collecting…' : 'Get x-device-id header'}
            onPress={onBuild}
            disabled={busy || !merchantId}
          />
          {CHARGE_URL ? (
            <Button
              label="Send request"
              onPress={onSend}
              disabled={busy || !merchantId}
              secondary
            />
          ) : null}

          {headers ? (
            <View style={styles.section}>
              <Text style={styles.heading}>{PROTECTION_HEADER}</Text>
              <Text style={[styles.mono, !deviceId && styles.muted]} selectable>
                {deviceId ?? '(empty — run a dev build, not Expo Go)'}
              </Text>

              <Text style={styles.heading}>Request headers</Text>
              <Text style={styles.mono} selectable>
                {JSON.stringify(headers, null, 2)}
              </Text>
            </View>
          ) : null}

          {response ? (
            <View style={styles.section}>
              <Text style={styles.heading}>Response</Text>
              <Text style={styles.mono} selectable>
                {response}
              </Text>
            </View>
          ) : null}

          <View
            onLayout={event =>
              (cardSectionY.current = event.nativeEvent.layout.y)
            }
          >
            <CardCheckout
              merchantId={merchantId}
              onResult={() => (scrollToResult.current = true)}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CardCheckout({
  merchantId,
  onResult,
}: {
  merchantId: string;
  onResult: () => void;
}) {
  const getFraudHeaders = useCoinflowFraudHeaders();
  const cardFormRef = useRef<CardFormNativeRef>(null);
  const [sessionKey, setSessionKey] = useState(DEFAULT_SESSION_KEY);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onPay = async () => {
    if (!cardFormRef.current || !merchantId || !sessionKey) return;
    // The card form's WebView keeps the keyboard up, which would hide the result.
    Keyboard.dismiss();
    // Cleared first so the new result always changes the content size, which is what triggers the scroll.
    setResult(null);
    setBusy(true);
    try {
      const {token, expMonth, expYear} = await cardFormRef.current.tokenize();
      const res = await fetch(`${API_URL}/checkout/card/${merchantId}`, {
        method: 'POST',
        headers: {
          ...(await getFraudHeaders()),
          'x-coinflow-auth-session-key': sessionKey.trim(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          subtotal: {cents: SUBTOTAL_CENTS},
          card: {cardToken: token, expMonth, expYear, ...SAMPLE_CUSTOMER},
          chargebackProtectionData: SAMPLE_CHARGEBACK_PROTECTION_DATA,
        }),
      });
      const text = `${res.status} ${res.statusText}\n${await res.text()}`;
      onResult();
      setResult(text);
    } catch (e) {
      onResult();
      setResult(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Card checkout</Text>
      {merchantId ? (
        <CoinflowCardForm ref={cardFormRef} merchantId={merchantId} env={ENV} />
      ) : (
        <Text style={styles.hint}>
          Enter a merchant ID to load the card form.
        </Text>
      )}
      <Field
        label="Session key"
        value={sessionKey}
        onChangeText={setSessionKey}
        placeholder="From GET /api/auth/session-key"
      />
      <Button
        label={busy ? 'Paying…' : `Pay $${(SUBTOTAL_CENTS / 100).toFixed(2)}`}
        onPress={onPay}
        disabled={busy || !merchantId || !sessionKey}
      />
      {sessionKey ? null : (
        <Text style={styles.hint}>
          Paste a customer session key to pay. Your backend gets one from GET
          /api/auth/session-key with your API key.
        </Text>
      )}
      {result ? (
        <Text style={styles.mono} selectable>
          {result}
        </Text>
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  onEndEditing,
  onFocus,
  onBlur,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onEndEditing?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onEndEditing}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function Button({
  label,
  onPress,
  disabled,
  secondary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[styles.buttonText, secondary && styles.buttonTextSecondary]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  content: {padding: 20, gap: 12},
  title: {fontSize: 22, fontWeight: '700', color: '#05092E'},
  subtitle: {fontSize: 13, color: '#6B7280', marginBottom: 8},
  code: {fontFamily: 'monospace', color: '#05092E'},
  button: {
    paddingVertical: 14,
    backgroundColor: '#165DFB',
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#165DFB',
  },
  buttonDisabled: {opacity: 0.6},
  buttonText: {color: '#fff', fontSize: 15, fontWeight: '600'},
  buttonTextSecondary: {color: '#165DFB'},
  section: {gap: 6, marginTop: 8},
  heading: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#05092E',
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 8,
  },
  muted: {color: '#9CA3AF'},
  hint: {fontSize: 13, color: '#6B7280'},
  field: {gap: 4},
  label: {fontSize: 13, color: '#6B7280', fontWeight: '600'},
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#05092E',
  },
});
