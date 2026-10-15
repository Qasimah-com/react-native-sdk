import React from 'react';
import { I18nManager, Platform, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PROMO_LINK_COLOR, QasimhaLogo, QasimhaPromo } from '../src';
import { rowStyle } from '../src/promo/layout';
import { normalizeApiBaseUrl, parseAmount, parsePlans, plansUrl } from '../src/promo/plans';

const envelope = {
  success: true,
  code: 'OK',
  data: {
    merchantName: 'Demo Store',
    currency: 'SAR',
    minAmount: 100,
    maxAmount: 20000,
    plans: [
      {
        instalments: 4,
        frequency: 'monthly',
        instalmentAmount: 300,
        firstInstalmentAmount: 300,
        lastInstalmentAmount: 300,
        feesIncludingVat: 0,
        totalPayable: 1200,
        shariaCompliant: true,
      },
    ],
  },
};

type FetchResponse = { ok: boolean; json: () => Promise<unknown> };
type FetchMock = jest.Mock<Promise<FetchResponse>, [string, RequestInit | undefined]>;

function mockFetch(body: unknown = envelope, ok = true): FetchMock {
  const mock: FetchMock = jest.fn<Promise<FetchResponse>, [string, RequestInit | undefined]>(() => Promise.resolve({ ok, json: () => Promise.resolve(body) }));
  (globalThis as { fetch: unknown }).fetch = mock;
  return mock;
}

type HostJson = { type: string; props: Record<string, unknown>; children: Array<HostJson | string> | null };

function findHost(node: HostJson | string | Array<HostJson | string> | null, testID: string): HostJson | null {
  if (node === null || typeof node === 'string') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findHost(child, testID);
      if (found) return found;
    }
    return null;
  }
  if (node.props.testID === testID) return node;
  return findHost(node.children, testID);
}

function flattenStyle(style: unknown): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.assign(flat, value);
  };
  visit(style);
  return flat;
}

function textOf(node: { props: { children?: unknown } }): string {
  const children = node.props.children;
  return Array.isArray(children) ? children.join('') : String(children ?? '');
}

const originalFetch = (globalThis as { fetch?: unknown }).fetch;

afterEach(() => {
  (globalThis as { fetch?: unknown }).fetch = originalFetch;
});

describe('QasimhaPromo', () => {
  it('renders the Arabic sentence with the riyal symbol before the digits in an ltr row', async () => {
    const fetch = mockFetch();
    render(<QasimhaPromo amount={1200} publicKey="pk_test_abc123" />);
    const money = await screen.findByTestId('qasimha-money');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toBe('https://merchant-api-uat.qasimha.com/api/v1/widget/plans?amount=1200.00&currency=SAR&lang=ar');
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'omit', headers: { 'X-Public-Key': 'pk_test_abc123', Accept: 'application/json' } });

    const host = findHost(screen.toJSON() as HostJson | HostJson[] | null, 'qasimha-money');
    const order = (host?.children ?? []).map((child) => (typeof child === 'string' ? child : child.props.testID));
    expect(order).toEqual(['qasimha-riyal-placeholder', 'qasimha-money-amount']);
    expect(flattenStyle(money.props.style)).toMatchObject({ flexDirection: 'row', direction: 'ltr' });
    expect(textOf(screen.getByTestId('qasimha-money-amount'))).toBe('300');

    const line = screen.getByTestId('qasimha-promo-line');
    expect(flattenStyle(line.props.style)).toMatchObject({ flexDirection: 'row', direction: 'rtl' });
    expect(screen.getByText('قسّمها على 4 دفعات شهرية بقيمة ')).toBeTruthy();
    expect(screen.getByTestId('qasimha-promo-trust')).toBeTruthy();
    expect(screen.getByTestId('qasimha-promo').props.accessibilityLabel).toBe('قسّمها على 4 دفعات شهرية بقيمة 300 ريال');
  });

  it('renders English with a live key against production and never shows a currency word', async () => {
    const fetch = mockFetch();
    render(<QasimhaPromo amount="300.50" publicKey="pk_live_xyz" lang="en" />);
    await screen.findByTestId('qasimha-money');
    expect(fetch.mock.calls[0]?.[0]).toBe('https://api.qasimha.com/api/v1/widget/plans?amount=300.50&currency=SAR&lang=en');
    expect(screen.getByText('Split into 4 monthly payments of ')).toBeTruthy();
    const visible = screen.UNSAFE_getAllByType(Text).map(textOf).join('|');
    expect(visible).not.toContain('SAR');
    expect(visible).not.toContain('ريال');
    expect(visible).not.toContain('﷼');
    expect(flattenStyle(screen.getByTestId('qasimha-promo-line').props.style)).toMatchObject({ direction: 'ltr' });
  });

  it('sizes the placeholder symbol from the text style and keeps the glyph aspect ratio', async () => {
    mockFetch();
    render(<QasimhaPromo amount={1200} publicKey="pk_test_abc123" textStyle={{ fontSize: 20, color: '#123456' }} />);
    const placeholder = await screen.findByTestId('qasimha-riyal-placeholder', { includeHiddenElements: true });
    const style = flattenStyle(placeholder.props.style);
    expect(style.height).toBeCloseTo(16.4, 5);
    expect(style.width).toBeCloseTo(16.4 * (1124.14 / 1256.39), 1);
    expect(placeholder.props.importantForAccessibility).toBe('no');
  });

  it('uses renderSymbol when given', async () => {
    mockFetch();
    render(<QasimhaPromo amount={1200} publicKey="pk_test_abc123" renderSymbol={({ size, color }) => <Text testID="custom-symbol">{`${size}:${color}`}</Text>} />);
    const custom = await screen.findByTestId('custom-symbol');
    expect(textOf(custom)).toBe('11.48:#1f2937');
    expect(screen.queryByTestId('qasimha-riyal-placeholder', { includeHiddenElements: true })).toBeNull();
  });

  it.each([
    ['non-2xx status', envelope, false],
    ['success false', { ...envelope, success: false }, true],
    ['wrong currency', { ...envelope, data: { ...envelope.data, currency: 'USD' } }, true],
    ['no plans', { ...envelope, data: { ...envelope.data, plans: [] } }, true],
    ['amount above maxAmount', { ...envelope, data: { ...envelope.data, maxAmount: 1000 } }, true],
    ['malformed plan', { ...envelope, data: { ...envelope.data, plans: [{ instalments: 'four' }] } }, true],
    ['not an object', 'nope', true],
  ])('renders nothing on %s', async (_name, body, ok) => {
    const fetch = mockFetch(body, ok);
    render(<QasimhaPromo amount={1200} publicKey="pk_test_abc123" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('qasimha-promo')).toBeNull();
  });

  it('renders nothing when fetch rejects', async () => {
    const fetch: FetchMock = jest.fn<Promise<FetchResponse>, [string, RequestInit | undefined]>(() => Promise.reject(new Error('offline')));
    (globalThis as { fetch: unknown }).fetch = fetch;
    render(<QasimhaPromo amount={1200} publicKey="pk_test_abc123" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('qasimha-promo')).toBeNull();
  });

  it.each([
    ['bad public key', { amount: 1200, publicKey: 'sk_test_abc' }],
    ['zero amount', { amount: 0, publicKey: 'pk_test_abc' }],
    ['three decimals', { amount: 12.345, publicKey: 'pk_test_abc' }],
    ['malformed string amount', { amount: '12,00', publicKey: 'pk_test_abc' }],
    ['http api base', { amount: 1200, publicKey: 'pk_test_abc', apiBaseUrl: 'http://merchant-api-uat.qasimha.com' }],
  ])('does not call the API on %s', async (_name, props) => {
    const fetch = mockFetch();
    render(<QasimhaPromo {...props} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId('qasimha-promo')).toBeNull();
  });

  it('accepts a local http api base for development', async () => {
    const fetch = mockFetch();
    render(<QasimhaPromo amount={1200} publicKey="pk_test_abc" apiBaseUrl="http://localhost:5000/" />);
    await screen.findByTestId('qasimha-money');
    expect(fetch.mock.calls[0]?.[0]).toBe('http://localhost:5000/api/v1/widget/plans?amount=1200.00&currency=SAR&lang=ar');
  });
});

describe('QasimhaPromo branding', () => {
  it('falls back to the coral text pill when react-native-svg is absent', async () => {
    mockFetch();
    render(<QasimhaPromo amount={1200} publicKey="pk_test_abc123" textStyle={{ fontSize: 20 }} />);
    await screen.findByTestId('qasimha-money');
    const pill = screen.getByTestId('qasimha-logo-pill', { includeHiddenElements: true });
    expect(flattenStyle(pill.props.style)).toMatchObject({ backgroundColor: '#fd6c43', height: 29 });
    expect(screen.getByText('قسّمها', { includeHiddenElements: true })).toBeTruthy();
  });

  it('names the pill in the shopper language', () => {
    render(<QasimhaLogo lang="en" height={24} />);
    const pill = screen.getByTestId('qasimha-logo-pill');
    expect(pill.props.accessibilityLabel).toBe('Qasimha');
    expect(screen.getByText('Qasimha')).toBeTruthy();
    expect(flattenStyle(pill.props.style)).toMatchObject({ height: 24, borderRadius: 12 });
  });

  it('hides the logo on request', async () => {
    mockFetch();
    render(<QasimhaPromo amount={1200} publicKey="pk_test_abc123" showLogo={false} />);
    await screen.findByTestId('qasimha-money');
    expect(screen.queryByTestId('qasimha-logo-pill', { includeHiddenElements: true })).toBeNull();
  });

  it('renders the learn-more link in the darker coral and calls back on press', async () => {
    mockFetch();
    const onLearnMore = jest.fn();
    render(<QasimhaPromo amount={1200} publicKey="pk_test_abc123" lang="en" onLearnMore={onLearnMore} />);
    const link = await screen.findByTestId('qasimha-promo-learn-more');
    expect(textOf(link)).toBe('Learn more');
    expect(flattenStyle(link.props.style)).toMatchObject({ color: PROMO_LINK_COLOR, textDecorationLine: 'underline' });
    expect(PROMO_LINK_COLOR).toBe('#b9431f');
    expect(textOf(screen.getByTestId('qasimha-promo-trust'))).toBe('Interest-free · Sharia-compliant · ');
    fireEvent.press(link);
    expect(onLearnMore).toHaveBeenCalledTimes(1);
  });

  it('reports the headline plan, or null when there is none', async () => {
    mockFetch();
    const onPlan = jest.fn();
    render(<QasimhaPromo amount={1200} publicKey="pk_test_abc123" onPlan={onPlan} />);
    await screen.findByTestId('qasimha-money');
    expect(onPlan).toHaveBeenLastCalledWith(expect.objectContaining({ instalments: 4, instalmentAmount: 300 }));

    const empty = mockFetch({ ...envelope, data: { ...envelope.data, plans: [] } });
    const onNone = jest.fn();
    render(<QasimhaPromo amount={50} publicKey="pk_test_abc123" onPlan={onNone} />);
    await waitFor(() => expect(empty).toHaveBeenCalled());
    await waitFor(() => expect(onNone).toHaveBeenCalledWith(null));

    const invalid = jest.fn();
    render(<QasimhaPromo amount={0} publicKey="pk_test_abc123" onPlan={invalid} />);
    expect(invalid).toHaveBeenCalledWith(null);
  });
});

describe('plans helpers', () => {
  it('parses amounts strictly', () => {
    expect(parseAmount(1200)).toBe(1200);
    expect(parseAmount(300.5)).toBe(300.5);
    expect(parseAmount('300.50')).toBe(300.5);
    expect(parseAmount(' 1200 ')).toBe(1200);
    expect(parseAmount(0)).toBeNull();
    expect(parseAmount(-1)).toBeNull();
    expect(parseAmount(1.005)).toBeNull();
    expect(parseAmount('1e3')).toBeNull();
    expect(parseAmount(NaN)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });

  it('normalises the api base url', () => {
    expect(normalizeApiBaseUrl(undefined, 'pk_live_x')).toBe('https://api.qasimha.com');
    expect(normalizeApiBaseUrl('', 'pk_test_x')).toBe('https://merchant-api-uat.qasimha.com');
    expect(normalizeApiBaseUrl('https://merchant-api-uat.qasimha.com/', 'pk_test_x')).toBe('https://merchant-api-uat.qasimha.com');
    expect(normalizeApiBaseUrl('http://127.0.0.1:8080', 'pk_test_x')).toBe('http://127.0.0.1:8080');
    expect(normalizeApiBaseUrl('http://shop.example', 'pk_test_x')).toBeNull();
    expect(normalizeApiBaseUrl('https://user:pw@api.qasimha.com', 'pk_test_x')).toBeNull();
    expect(normalizeApiBaseUrl('https://api.qasimha.com/?x=1', 'pk_test_x')).toBeNull();
    expect(normalizeApiBaseUrl(42, 'pk_test_x')).toBeNull();
  });

  it('builds the plans url and parses the envelope', () => {
    expect(plansUrl('https://api.qasimha.com', 12.3, 'en')).toBe('https://api.qasimha.com/api/v1/widget/plans?amount=12.30&currency=SAR&lang=en');
    expect(parsePlans(envelope, 1200)?.plans[0]?.instalments).toBe(4);
    expect(parsePlans(envelope, 50)).toBeNull();
  });
});

describe('rowStyle', () => {
  it('uses the direction prop on iOS', () => {
    expect(rowStyle('ltr')).toEqual({ flexDirection: 'row', direction: 'ltr' });
  });

  it('falls back to row-reverse on Android Paper when the app is RTL', () => {
    const os = jest.replaceProperty(Platform, 'OS', 'android');
    const rtl = jest.replaceProperty(I18nManager, 'isRTL', true);
    const scope = globalThis as { nativeFabricUIManager?: unknown };
    const hadFabric = Object.prototype.hasOwnProperty.call(scope, 'nativeFabricUIManager');
    const previous = scope.nativeFabricUIManager;
    delete scope.nativeFabricUIManager;
    try {
      expect(rowStyle('ltr')).toEqual({ flexDirection: 'row-reverse' });
      expect(rowStyle('rtl')).toEqual({ flexDirection: 'row' });
      scope.nativeFabricUIManager = {};
      expect(rowStyle('ltr')).toEqual({ flexDirection: 'row', direction: 'ltr' });
    } finally {
      if (hadFabric) scope.nativeFabricUIManager = previous;
      else delete scope.nativeFabricUIManager;
      os.restore();
      rtl.restore();
    }
  });
});
