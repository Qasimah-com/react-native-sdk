import React from 'react';
import { View } from 'react-native';

type Props = { [key: string]: unknown; children?: React.ReactNode };

export function Svg(props: Props): React.JSX.Element {
  return React.createElement(View, { testID: props.testID as string, accessibilityLabel: props.viewBox as string }, props.children);
}

export function Path(props: Props): React.JSX.Element {
  return React.createElement(View, { testID: (props.testID as string | undefined) ?? 'qasimha-riyal-path', accessibilityLabel: `${props.d}|${props.fill}` });
}

export default Svg;
