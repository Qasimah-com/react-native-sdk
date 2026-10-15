import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { formatAmount } from '../money';
import type { Language } from '../types';
import { COPY, accessibilityLabel, summaryParts, trustLine } from './i18n';
import { rowStyle, type Direction } from './layout';
import { PUBLIC_KEY_RE, fetchPlans, normalizeApiBaseUrl, parseAmount, type Plan } from './plans';
import { QasimhaLogo } from './QasimhaLogo';
import { RiyalSymbol } from './RiyalSymbol';

export type RenderSymbol = (symbol: { size: number; color: string }) => React.ReactNode;

export interface QasimhaPromoProps {
  amount: number | string;
  publicKey: string;
  lang?: Language;
  apiBaseUrl?: string;
  renderSymbol?: RenderSymbol;
  showLogo?: boolean;
  onLearnMore?: () => void;
  onPlan?: (plan: Plan | null) => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

const DEFAULT_FONT_SIZE = 14;
const DEFAULT_COLOR = '#1f2937';
const SYMBOL_EM = 0.82;
const LOGO_EM = 1.45;
export const PROMO_LINK_COLOR = '#b9431f';

const styles = StyleSheet.create({
  container: { alignSelf: 'flex-start', maxWidth: '100%' },
  badge: { alignItems: 'center', gap: 8, maxWidth: '100%' },
  column: { flexShrink: 1, minWidth: 0 },
  sub: { flexWrap: 'wrap', alignItems: 'center', marginTop: 2 },
  rtl: { direction: 'rtl' },
  ltr: { direction: 'ltr' },
  line: { flexWrap: 'wrap', alignItems: 'center' },
  text: { fontSize: DEFAULT_FONT_SIZE, color: DEFAULT_COLOR },
  money: { alignItems: 'center' },
  symbol: { marginRight: 3 },
  number: { writingDirection: 'ltr', fontVariant: ['tabular-nums'] },
  trust: { opacity: 0.75 },
  link: { color: PROMO_LINK_COLOR, textDecorationLine: 'underline' },
});

export function QasimhaPromo(props: QasimhaPromoProps): React.JSX.Element | null {
  const { amount, publicKey, apiBaseUrl, renderSymbol, showLogo = true, onLearnMore, onPlan, style, textStyle, testID } = props;
  const lang: Language = props.lang === 'en' ? 'en' : 'ar';
  const key = typeof publicKey === 'string' ? publicKey.trim() : '';
  const validKey = PUBLIC_KEY_RE.test(key);
  const base = validKey ? normalizeApiBaseUrl(apiBaseUrl, key) : null;
  const value = parseAmount(amount);
  const [plan, setPlan] = useState<Plan | null>(null);
  const onPlanRef = useRef(onPlan);

  useEffect(() => {
    onPlanRef.current = onPlan;
  });

  useEffect(() => {
    setPlan(null);
    if (!validKey || base === null || value === null) {
      onPlanRef.current?.(null);
      return undefined;
    }
    let active = true;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    fetchPlans({ apiBaseUrl: base, publicKey: key, amount: value, lang, signal: controller ? controller.signal : undefined }).then(
      (data) => {
        if (!active) return;
        const next = data ? (data.plans[0] ?? null) : null;
        setPlan(next);
        onPlanRef.current?.(next);
      },
      () => {
        if (!active) return;
        setPlan(null);
        onPlanRef.current?.(null);
      },
    );
    return () => {
      active = false;
      if (controller) controller.abort();
    };
  }, [validKey, base, value, key, lang]);

  if (!plan) return null;

  const flat = StyleSheet.flatten(textStyle) ?? {};
  const fontSize = typeof flat.fontSize === 'number' ? flat.fontSize : DEFAULT_FONT_SIZE;
  const color = typeof flat.color === 'string' ? flat.color : DEFAULT_COLOR;
  const symbolSize = Math.round(fontSize * SYMBOL_EM * 100) / 100;
  const amountText = formatAmount(plan.instalmentAmount);
  const trust = trustLine(lang, plan);
  const direction: Direction = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <View
      testID={testID ?? 'qasimha-promo'}
      style={[styles.container, lang === 'ar' ? styles.rtl : styles.ltr, style]}
      accessible={!onLearnMore}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel(lang, plan, amountText)}
    >
      <View style={[styles.badge, rowStyle(direction)]}>
        {showLogo ? <QasimhaLogo height={Math.round(fontSize * LOGO_EM)} lang={lang} /> : null}
        <View style={styles.column}>
          <View testID="qasimha-promo-line" style={[styles.line, rowStyle(direction)]}>
            {summaryParts(lang, plan).map((part, index) =>
              part.kind === 'text' ? (
                <Text key={index} style={[styles.text, textStyle]}>
                  {part.text}
                </Text>
              ) : (
                <View key={index} testID="qasimha-money" style={[styles.money, rowStyle('ltr')]}>
                  {renderSymbol ? renderSymbol({ size: symbolSize, color }) : <RiyalSymbol size={symbolSize} color={color} style={styles.symbol} />}
                  <Text testID="qasimha-money-amount" style={[styles.text, textStyle, styles.number]}>
                    {amountText}
                  </Text>
                </View>
              ),
            )}
          </View>
          {trust || onLearnMore ? (
            <View style={[styles.sub, rowStyle(direction)]}>
              {trust ? (
                <Text testID="qasimha-promo-trust" style={[styles.text, textStyle, styles.trust]}>
                  {onLearnMore ? trust + COPY[lang].separator : trust}
                </Text>
              ) : null}
              {onLearnMore ? (
                <Text testID="qasimha-promo-learn-more" accessibilityRole="link" onPress={onLearnMore} style={[styles.text, textStyle, styles.link]}>
                  {COPY[lang].learnMore}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
