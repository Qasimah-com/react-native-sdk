import { NativeModules, Platform } from 'react-native';
import { QasimhaCheckoutError, handleReturn, isCheckoutInProgress, startCheckout, type CheckoutOptions, type MerchantUrl } from '../src';
import { RETURN_GRACE_MS } from '../src/checkout';

type NativeMock = { open: jest.Mock; close: jest.Mock };

const merchantUrl: MerchantUrl = {
  success: 'https://shop.example/qasimha/return?order=1001',
  failure: 'https://shop.example/qasimha/return?order=1001',
  cancel: 'https://shop.example/cart',
};
const customUrl: MerchantUrl = { success: 'myshop://qasimha/return', failure: 'myshop://qasimha/return', cancel: 'myshop://qasimha/return' };
const orderId = '3f6c2f7e-1b7c-4d7e-9a0b-6f9d2e1c4a5b';
const successUrl = `https://shop.example/qasimha/return?order=1001&orderId=${orderId}&orderReferenceId=ORD-1001&status=confirmed`;

function install(): NativeMock {
  const native: NativeMock = { open: jest.fn(() => new Promise(() => undefined)), close: jest.fn(() => Promise.resolve()) };
  (NativeModules as Record<string, unknown>).QasimhaCheckout = native;
  return native;
}

function options(overrides: Partial<CheckoutOptions> = {}): CheckoutOptions {
  return { paymentUrl: 'https://merchant-api-uat.qasimha.com/pay/abc123', merchantUrl, ...overrides };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  if (isCheckoutInProgress()) handleReturn('https://shop.example/cart?status=cancelled');
  jest.useRealTimers();
  delete (NativeModules as Record<string, unknown>).QasimhaCheckout;
});

describe('startCheckout', () => {
  it('opens the system browser and resolves when handleReturn sees the success URL', async () => {
    const native = install();
    const promise = startCheckout(options({ language: 'ar' }));
    expect(native.open).toHaveBeenCalledWith('https://merchant-api-uat.qasimha.com/pay/abc123', { presentation: 'systemBrowser', language: 'ar' });
    expect(isCheckoutInProgress()).toBe(true);
    expect(handleReturn(successUrl)).toBe(true);
    await expect(promise).resolves.toEqual({ type: 'success', orderId, orderReferenceId: 'ORD-1001' });
    expect(native.close).toHaveBeenCalledTimes(1);
    expect(isCheckoutInProgress()).toBe(false);
  });

  it('ignores URLs that do not match the merchant URLs', async () => {
    install();
    const promise = startCheckout(options());
    expect(handleReturn('https://shop.example/product/42')).toBe(false);
    expect(handleReturn('https://evil.example/qasimha/return?status=confirmed')).toBe(false);
    expect(handleReturn(42 as unknown as string)).toBe(false);
    expect(isCheckoutInProgress()).toBe(true);
    handleReturn(`https://shop.example/qasimha/return?order=1001&orderId=${orderId}&status=declined`);
    await expect(promise).resolves.toEqual({ type: 'failure', status: 'declined', orderId });
  });

  it('returns false from handleReturn when no checkout is pending', () => {
    install();
    expect(handleReturn(successUrl)).toBe(false);
  });

  it('resolves cancelled after the grace period when the sheet is dismissed', async () => {
    jest.useFakeTimers();
    const native = install();
    native.open.mockResolvedValueOnce({ dismissed: true });
    const promise = startCheckout(options());
    await flush();
    expect(isCheckoutInProgress()).toBe(true);
    jest.advanceTimersByTime(RETURN_GRACE_MS);
    await expect(promise).resolves.toEqual({ type: 'cancelled' });
    expect(native.close).not.toHaveBeenCalled();
  });

  it('lets a return URL that arrives inside the grace period win over cancelled', async () => {
    jest.useFakeTimers();
    const native = install();
    native.open.mockResolvedValueOnce({ dismissed: true });
    const promise = startCheckout(options());
    await flush();
    jest.advanceTimersByTime(RETURN_GRACE_MS - 1);
    expect(handleReturn(successUrl)).toBe(true);
    jest.advanceTimersByTime(RETURN_GRACE_MS);
    await expect(promise).resolves.toEqual({ type: 'success', orderId, orderReferenceId: 'ORD-1001' });
  });

  it('parses the callback URL a web authentication session hands back', async () => {
    const native = install();
    native.open.mockResolvedValueOnce({ dismissed: false, url: `myshop://qasimha/return?orderId=${orderId}&status=expired` });
    const result = await startCheckout(options({ merchantUrl: customUrl, presentation: 'webAuthenticationSession' }));
    expect(native.open).toHaveBeenCalledWith(expect.any(String), { presentation: 'webAuthenticationSession', callbackScheme: 'myshop' });
    expect(result).toEqual({ type: 'failure', status: 'expired', orderId });
    expect(native.close).not.toHaveBeenCalled();
  });

  it('passes an https callback host and path to the web authentication session', async () => {
    const native = install();
    const shared: MerchantUrl = { success: 'https://shop.example/r', failure: 'https://shop.example/r', cancel: 'https://shop.example/r' };
    native.open.mockResolvedValueOnce({ dismissed: false, url: `https://shop.example/r?orderId=${orderId}&status=confirmed` });
    await expect(startCheckout(options({ merchantUrl: shared, presentation: 'webAuthenticationSession' }))).resolves.toEqual({ type: 'success', orderId });
    expect(native.open).toHaveBeenCalledWith(expect.any(String), { presentation: 'webAuthenticationSession', callbackHost: 'shop.example', callbackPath: '/r' });
  });

  it('reports an unmatched callback URL as an unknown failure', async () => {
    const native = install();
    native.open.mockResolvedValueOnce({ dismissed: false, url: 'myshop://elsewhere' });
    await expect(startCheckout(options({ merchantUrl: customUrl, presentation: 'webAuthenticationSession' }))).resolves.toEqual({
      type: 'failure',
      status: 'unknown',
    });
  });

  it('downgrades webAuthenticationSession to the system browser on Android', async () => {
    const native = install();
    const spy = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const promise = startCheckout(options({ merchantUrl: customUrl, presentation: 'webAuthenticationSession' }));
      expect(native.open).toHaveBeenCalledWith(expect.any(String), { presentation: 'systemBrowser' });
      handleReturn(`myshop://qasimha/return?orderId=${orderId}&status=confirmed`);
      await expect(promise).resolves.toEqual({ type: 'success', orderId });
    } finally {
      spy.restore();
    }
  });

  it('rejects a second checkout while one is in progress', async () => {
    install();
    const first = startCheckout(options());
    await expect(startCheckout(options())).rejects.toMatchObject({ code: 'IN_PROGRESS' });
    handleReturn(successUrl);
    await first;
  });

  it('maps native rejections to QasimhaCheckoutError with the native code', async () => {
    const native = install();
    native.open.mockRejectedValueOnce(Object.assign(new Error('No browser is available'), { code: 'NO_BROWSER' }));
    const error = await startCheckout(options()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QasimhaCheckoutError);
    expect((error as QasimhaCheckoutError).code).toBe('NO_BROWSER');
    expect((error as QasimhaCheckoutError).message).toBe('No browser is available');
    expect(isCheckoutInProgress()).toBe(false);
  });

  it('maps unknown native errors to NATIVE_ERROR', async () => {
    const native = install();
    native.open.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await expect(startCheckout(options())).rejects.toMatchObject({ code: 'NATIVE_ERROR', message: 'boom' });
  });

  it('rejects invalid options before touching the native module', async () => {
    const native = install();
    await expect(startCheckout(options({ paymentUrl: 'http://merchant-api-uat.qasimha.com/pay/abc' }))).rejects.toMatchObject({
      code: 'INVALID_OPTIONS',
      field: 'paymentUrl',
    });
    expect(native.open).not.toHaveBeenCalled();
  });

  it('rejects when the native module is not linked', async () => {
    await expect(startCheckout(options())).rejects.toMatchObject({ code: 'NATIVE_MODULE_MISSING' });
  });
});
