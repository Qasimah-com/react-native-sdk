import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Language } from '../types';
import { COPY } from './i18n';
import { LOGO_ASPECT_RATIO, LOGO_ON_PRIMARY, LOGO_PATHS, LOGO_PRIMARY, LOGO_VIEWBOX } from './logo';
import { optionalSvg } from './svg';

export interface QasimhaLogoProps {
  height?: number;
  lang?: Language;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const styles = StyleSheet.create({
  pill: { alignItems: 'center', justifyContent: 'center', backgroundColor: LOGO_PRIMARY },
  pillText: { color: LOGO_ON_PRIMARY, fontWeight: '700', includeFontPadding: false, textAlignVertical: 'center' },
});

export function logoWidth(height: number): number {
  return Math.round(height * LOGO_ASPECT_RATIO * 100) / 100;
}

export function QasimhaLogo({ height = 20, lang, style, testID }: QasimhaLogoProps): React.JSX.Element {
  const label = COPY[lang === 'en' ? 'en' : 'ar'].wordmark;
  const width = logoWidth(height);
  const svg = optionalSvg();
  if (!svg) {
    return (
      <View
        testID={testID ?? 'qasimha-logo-pill'}
        style={[styles.pill, { minWidth: width, height, borderRadius: height / 2, paddingHorizontal: height * 0.45 }, style]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        <Text style={[styles.pillText, { fontSize: Math.round(height * 0.58) }]} allowFontScaling={false} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }
  const { Svg, Path } = svg;
  return (
    <Svg
      testID={testID ?? 'qasimha-logo'}
      width={width}
      height={height}
      viewBox={LOGO_VIEWBOX}
      style={style}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {LOGO_PATHS.map(([d, fill], index) => (
        <Path key={index} testID="qasimha-logo-path" d={d} fill={fill} />
      ))}
    </Svg>
  );
}
