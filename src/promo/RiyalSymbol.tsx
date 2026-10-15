import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { RIYAL_ASPECT_RATIO, RIYAL_PATHS, RIYAL_VIEWBOX } from '../money';
import { optionalSvg } from './svg';

export interface RiyalSymbolProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function riyalSymbolWidth(size: number): number {
  return Math.round(size * RIYAL_ASPECT_RATIO * 100) / 100;
}

export function RiyalSymbol({ size = 14, color = '#1f2937', style }: RiyalSymbolProps): React.JSX.Element {
  const height = size;
  const width = riyalSymbolWidth(size);
  const svg = optionalSvg();
  if (!svg) {
    return (
      <View
        testID="qasimha-riyal-placeholder"
        style={[{ width, height }, style]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    );
  }
  const { Svg, Path } = svg;
  return (
    <Svg
      testID="qasimha-riyal"
      width={width}
      height={height}
      viewBox={RIYAL_VIEWBOX}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {RIYAL_PATHS.map((d, index) => (
        <Path key={index} d={d} fill={color} />
      ))}
    </Svg>
  );
}
