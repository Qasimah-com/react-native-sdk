import React, { useCallback, useEffect, useState } from 'react';
import { Button, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { QasimhaPromo, handleReturn, startCheckout, type CheckoutResult, type MerchantUrl } from '@qasimha/react-native-sdk';

const merchantUrl: MerchantUrl = {
  success: 'myshop://qasimha/return',
  failure: 'myshop://qasimha/return',
  cancel: 'myshop://qasimha/cancel',
};

const SANDBOX_PUBLIC_KEY = 'pk_test_REPLACE_WITH_YOUR_SANDBOX_KEY';

export default function App(): React.JSX.Element {
  const [paymentUrl, setPaymentUrl] = useState('');
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleReturn(url);
    });
    Linking.getInitialURL().then((url) => {
      if (url) handleReturn(url);
    });
    return () => subscription.remove();
  }, []);

  const pay = useCallback(async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const outcome = await startCheckout({ paymentUrl: paymentUrl.trim(), merchantUrl, language: 'ar' });
      setResult(outcome);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [paymentUrl]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Qasimha checkout sample</Text>
        <Text style={styles.hint}>
          Create the checkout session on your server with a server SDK and paste the paymentUrl it returns. The app never holds an API key.
        </Text>
        <TextInput
          style={styles.input}
          value={paymentUrl}
          onChangeText={setPaymentUrl}
          placeholder="https://merchant-api-uat.qasimha.com/pay/…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Button title={busy ? 'Opening…' : 'Pay with Qasimha'} onPress={pay} disabled={busy || paymentUrl.trim() === ''} />

        {result ? (
          <View style={styles.card}>
            <Text style={styles.label}>Result</Text>
            <Text>{JSON.stringify(result, null, 2)}</Text>
            <Text style={styles.hint}>
              A return URL is a navigation, not a proof. Ask your server to confirm the order with orders.get before treating it as paid.
            </Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.label}>Promo</Text>
          <QasimhaPromo amount={1200} publicKey={SANDBOX_PUBLIC_KEY} lang="ar" textStyle={styles.promo} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  hint: { color: '#4b5563' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10 },
  card: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, gap: 6 },
  label: { fontWeight: '600' },
  error: { color: '#b91c1c' },
  promo: { fontSize: 16, color: '#1f2937' },
});
