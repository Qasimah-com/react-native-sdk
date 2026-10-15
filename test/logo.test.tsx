import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LOGO_PATHS, QasimhaLogo, QasimhaPromo } from '../src';

jest.mock('react-native-svg', () => require('./mocks/reactNativeSvg'), { virtual: true });

const envelope = {
  success: true,
  data: {
    currency: 'SAR',
    minAmount: 100,
    maxAmount: 4000,
    plans: [{ instalments: 4, frequency: 'monthly', instalmentAmount: 300, firstInstalmentAmount: 300, lastInstalmentAmount: 300, feesIncludingVat: 0, totalPayable: 1200, shariaCompliant: true }],
  },
};

const originalFetch = (globalThis as { fetch?: unknown }).fetch;

afterEach(() => {
  (globalThis as { fetch?: unknown }).fetch = originalFetch;
});

describe('QasimhaLogo with react-native-svg installed', () => {
  it('draws the five logotype paths in the brand colours at the logo aspect ratio', () => {
    render(<QasimhaLogo height={32} />);
    const svg = screen.getByTestId('qasimha-logo');
    expect(svg.props.accessibilityLabel).toBe('0 0 155 64');
    const paths = screen.getAllByTestId('qasimha-logo-path');
    expect(paths).toHaveLength(5);
    expect(paths[0]?.props.accessibilityLabel).toMatch(/\|#FD6C43$/);
    for (const path of paths.slice(1)) expect(path.props.accessibilityLabel).toMatch(/\|#FFF8F6$/);
    expect(LOGO_PATHS).toHaveLength(5);
    expect(screen.queryByTestId('qasimha-logo-pill')).toBeNull();
  });

  it('puts the logo in the promo, sized from the text', async () => {
    (globalThis as { fetch: unknown }).fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(envelope) }));
    render(<QasimhaPromo amount={1200} publicKey="pk_test_abc" textStyle={{ fontSize: 20 }} />);
    await screen.findByTestId('qasimha-money');
    expect(screen.getByTestId('qasimha-logo', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getAllByTestId('qasimha-riyal-path', { includeHiddenElements: true })).toHaveLength(2);
  });
});
