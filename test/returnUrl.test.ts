import { QasimhaCheckoutError } from '../src/errors';
import { matchReturnUrl, parseReturnUrl, parseUrl, queryParams, validateCheckoutOptions, validateReturnUrl } from '../src/returnUrl';
import type { CheckoutOptions, MerchantUrl } from '../src/types';

const merchantUrl: MerchantUrl = {
  success: 'https://shop.example/qasimha/return?order=1001',
  failure: 'https://shop.example/qasimha/return?order=1001',
  cancel: 'https://shop.example/cart',
};

const orderId = '3f6c2f7e-1b7c-4d7e-9a0b-6f9d2e1c4a5b';

function options(overrides: Partial<CheckoutOptions> = {}): CheckoutOptions {
  return { paymentUrl: 'https://merchant-api-uat.qasimha.com/pay/abc123', merchantUrl, ...overrides };
}

function expectInvalid(input: unknown, field: string): void {
  try {
    validateCheckoutOptions(input);
  } catch (error) {
    expect(error).toBeInstanceOf(QasimhaCheckoutError);
    expect((error as QasimhaCheckoutError).code).toBe('INVALID_OPTIONS');
    expect((error as QasimhaCheckoutError).field).toBe(field);
    return;
  }
  throw new Error('expected validation to fail on ' + field);
}

describe('parseUrl', () => {
  it('splits scheme, host, path and query without the platform URL class', () => {
    const url = parseUrl('HTTPS://User:pw@Shop.Example:8443/a/b?x=1&y=2#frag');
    expect(url).toEqual({
      scheme: 'https',
      hasAuthority: true,
      hasUserInfo: true,
      host: 'shop.example:8443',
      hostname: 'shop.example',
      path: '/a/b',
      query: 'x=1&y=2',
      hasFragment: true,
    });
  });

  it('parses custom app schemes with and without an authority', () => {
    expect(parseUrl('myshop://qasimha/return?orderId=1')).toMatchObject({ scheme: 'myshop', host: 'qasimha', path: '/return', query: 'orderId=1' });
    expect(parseUrl('myshop:return')).toMatchObject({ scheme: 'myshop', hasAuthority: false, host: '', path: 'return' });
  });

  it('keeps IPv6 hosts intact', () => {
    expect(parseUrl('http://[::1]:3000/return')).toMatchObject({ host: '[::1]:3000', hostname: '[::1]' });
  });

  it('rejects relative and malformed input', () => {
    expect(parseUrl('/relative/path')).toBeNull();
    expect(parseUrl('not a url')).toBeNull();
    expect(parseUrl('')).toBeNull();
  });
});

describe('queryParams', () => {
  it('decodes percent escapes and plus signs, first value wins', () => {
    const params = queryParams('orderReferenceId=ORD%2D1001%2B2&status=confirmed&status=failed&note=a+b&flag');
    expect(params.get('orderReferenceId')).toBe('ORD-1001+2');
    expect(params.get('status')).toBe('confirmed');
    expect(params.get('note')).toBe('a b');
    expect(params.get('flag')).toBe('');
  });

  it('skips pairs that fail to decode', () => {
    expect(queryParams('bad=%E0%A4%A&ok=1').get('ok')).toBe('1');
    expect(queryParams('bad=%E0%A4%A&ok=1').has('bad')).toBe(false);
  });
});

describe('parseReturnUrl', () => {
  const base = 'https://shop.example/qasimha/return?order=1001';

  it('maps status=confirmed on the success URL to success with both ids', () => {
    expect(parseReturnUrl(`${base}&orderId=${orderId}&orderReferenceId=ORD-1001&status=confirmed`, merchantUrl)).toEqual({
      type: 'success',
      orderId,
      orderReferenceId: 'ORD-1001',
    });
  });

  it.each(['declined', 'expired', 'failed'])('maps status=%s on the failure URL to failure', (status) => {
    expect(parseReturnUrl(`${base}&orderId=${orderId}&orderReferenceId=ORD-1001&status=${status}`, merchantUrl)).toEqual({
      type: 'failure',
      status,
      orderId,
      orderReferenceId: 'ORD-1001',
    });
  });

  it('maps status=cancelled on the cancel URL to cancelled', () => {
    expect(parseReturnUrl(`https://shop.example/cart?orderId=${orderId}&orderReferenceId=ORD-1001&status=cancelled`, merchantUrl)).toEqual({
      type: 'cancelled',
    });
  });

  it('treats the cancel URL without a status as cancelled', () => {
    expect(parseReturnUrl('https://shop.example/cart', merchantUrl)).toEqual({ type: 'cancelled' });
  });

  it('preserves the merchant query string and ignores its extra parameters', () => {
    const result = parseReturnUrl(`https://shop.example/qasimha/return?order=1001&utm=x&orderId=${orderId}&status=confirmed`, merchantUrl);
    expect(result).toEqual({ type: 'success', orderId });
  });

  it('never reports success without an orderId', () => {
    expect(parseReturnUrl(`${base}&status=confirmed`, merchantUrl)).toEqual({ type: 'failure', status: 'unknown' });
  });

  it('reports an unknown status as a failure carrying the raw value', () => {
    expect(parseReturnUrl(`${base}&orderId=${orderId}&status=weird`, merchantUrl)).toEqual({ type: 'failure', status: 'weird', orderId });
    expect(parseReturnUrl(`${base}&orderId=${orderId}`, merchantUrl)).toEqual({ type: 'failure', status: 'unknown', orderId });
  });

  it('matches custom app schemes', () => {
    const custom: MerchantUrl = { success: 'myshop://qasimha/return', failure: 'myshop://qasimha/return', cancel: 'myshop://qasimha/cancel' };
    expect(parseReturnUrl(`myshop://qasimha/return?orderId=${orderId}&status=confirmed`, custom)).toEqual({ type: 'success', orderId });
    expect(parseReturnUrl(`MYSHOP://QASIMHA/cancel?status=cancelled`, custom)).toEqual({ type: 'cancelled' });
    expect(parseReturnUrl(`other://qasimha/return?orderId=${orderId}&status=confirmed`, custom)).toBeNull();
  });

  it('ignores other hosts, schemes, ports and unrelated paths', () => {
    expect(parseReturnUrl(`https://evil.example/qasimha/return?orderId=${orderId}&status=confirmed`, merchantUrl)).toBeNull();
    expect(parseReturnUrl(`http://shop.example/qasimha/return?orderId=${orderId}&status=confirmed`, merchantUrl)).toBeNull();
    expect(parseReturnUrl(`https://shop.example:8443/qasimha/return?status=confirmed`, merchantUrl)).toBeNull();
    expect(parseReturnUrl(`https://shop.example/qasimha/returned?status=confirmed`, merchantUrl)).toBeNull();
    expect(parseReturnUrl(`https://shop.example/other?status=confirmed`, merchantUrl)).toBeNull();
    expect(parseReturnUrl('garbage', merchantUrl)).toBeNull();
  });

  it('prefix-matches deeper paths at a segment boundary and is case-insensitive on the host', () => {
    expect(matchReturnUrl('https://SHOP.example/qasimha/return/extra?status=cancelled', merchantUrl)?.kind).toBe('success');
    expect(matchReturnUrl('https://shop.example/cart/', merchantUrl)?.kind).toBe('cancel');
  });

  it('matches a root-path merchant URL against any path on that host', () => {
    const root: MerchantUrl = { success: 'https://shop.example', failure: 'https://shop.example/', cancel: 'https://shop.example/cart' };
    expect(matchReturnUrl('https://shop.example/anything', root)?.kind).toBe('success');
  });
});

describe('validateReturnUrl', () => {
  it.each([
    'https://shop.example/return',
    'http://localhost:3000/return',
    'http://127.0.0.1/return',
    'myshop://qasimha/return',
    'com.example.shop://return',
  ])('accepts %s', (url) => {
    expect(validateReturnUrl(url, 'merchantUrl.success').scheme).toBeTruthy();
  });

  it.each([
    ['http://shop.example/return', 'must use https'],
    ['http://localhost.example/return', 'must use https'],
    ['javascript:alert(1)', 'must use https'],
    ['data:text/html,hi', 'must use https'],
    ['file:///etc/passwd', 'must use https'],
    ['blob:https://x', 'must use https'],
    ['vbscript:x', 'must use https'],
    ['ab://short-scheme', 'must use https'],
    ['https://shop.example/return#frag', 'must not carry a fragment'],
    ['/relative', 'must be an absolute URL'],
    ['https:///no-host', 'must name a host'],
    ['', 'is required'],
    ['https://shop.example/' + 'a'.repeat(1024), 'must be at most 1024 characters'],
  ])('rejects %s', (url, message) => {
    expect(() => validateReturnUrl(url, 'merchantUrl.success')).toThrow(message);
  });
});

describe('validateCheckoutOptions', () => {
  it('normalises valid options with the system browser as default', () => {
    expect(validateCheckoutOptions(options())).toEqual({
      paymentUrl: 'https://merchant-api-uat.qasimha.com/pay/abc123',
      merchantUrl,
      presentation: 'systemBrowser',
      callback: null,
    });
  });

  it('keeps language when given', () => {
    expect(validateCheckoutOptions(options({ language: 'en' })).language).toBe('en');
  });

  it('requires an https paymentUrl', () => {
    expectInvalid(options({ paymentUrl: 'http://merchant-api-uat.qasimha.com/pay/abc' }), 'paymentUrl');
    expectInvalid(options({ paymentUrl: 'myshop://pay' }), 'paymentUrl');
    expectInvalid(options({ paymentUrl: 'https://user:pw@merchant-api-uat.qasimha.com/pay/abc' }), 'paymentUrl');
    expectInvalid(options({ paymentUrl: '' }), 'paymentUrl');
  });

  it('requires all three merchant URLs', () => {
    expectInvalid({ paymentUrl: options().paymentUrl }, 'merchantUrl');
    expectInvalid(options({ merchantUrl: { success: merchantUrl.success, failure: merchantUrl.failure } as MerchantUrl }), 'merchantUrl.cancel');
    expectInvalid(options({ merchantUrl: { ...merchantUrl, failure: 'http://shop.example/x' } }), 'merchantUrl.failure');
  });

  it('rejects unknown presentation and language values', () => {
    expectInvalid(options({ presentation: 'webView' as never }), 'presentation');
    expectInvalid(options({ language: 'fr' as never }), 'language');
    expectInvalid(null, 'options');
  });

  it('derives a custom-scheme callback for webAuthenticationSession', () => {
    const custom: MerchantUrl = { success: 'myshop://qasimha/return', failure: 'myshop://qasimha/return', cancel: 'myshop://qasimha/cancel' };
    expect(validateCheckoutOptions(options({ merchantUrl: custom, presentation: 'webAuthenticationSession' })).callback).toEqual({ scheme: 'myshop' });
  });

  it('derives an https callback when the three URLs share host and path', () => {
    const shared: MerchantUrl = {
      success: 'https://shop.example/qasimha/return?order=1',
      failure: 'https://shop.example/qasimha/return?order=1&failed=1',
      cancel: 'https://shop.example/qasimha/return',
    };
    expect(validateCheckoutOptions(options({ merchantUrl: shared, presentation: 'webAuthenticationSession' })).callback).toEqual({
      host: 'shop.example',
      path: '/qasimha/return',
    });
  });

  it('refuses webAuthenticationSession when the return URLs cannot share one callback', () => {
    expectInvalid(options({ presentation: 'webAuthenticationSession' }), 'merchantUrl');
    const mixed: MerchantUrl = { success: 'myshop://return', failure: 'myshop://return', cancel: 'https://shop.example/cart' };
    expectInvalid(options({ merchantUrl: mixed, presentation: 'webAuthenticationSession' }), 'merchantUrl');
  });
});
