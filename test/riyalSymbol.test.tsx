import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RiyalSymbol } from '../src';

jest.mock('react-native-svg', () => require('./mocks/reactNativeSvg'), { virtual: true });

describe('RiyalSymbol with react-native-svg installed', () => {
  it('draws the two reference paths in the given colour', () => {
    render(<RiyalSymbol size={20} color="#0f6e56" />);
    const svg = screen.getByTestId('qasimha-riyal', { includeHiddenElements: true });
    expect(svg.props.accessibilityLabel).toBe('0 0 1124.14 1256.39');
    const paths = screen.getAllByTestId('qasimha-riyal-path', { includeHiddenElements: true });
    expect(paths).toHaveLength(2);
    for (const path of paths) expect(path.props.accessibilityLabel).toMatch(/^M.*\|#0f6e56$/);
    expect(screen.queryByTestId('qasimha-riyal-placeholder', { includeHiddenElements: true })).toBeNull();
  });
});
