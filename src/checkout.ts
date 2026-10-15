import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import { QasimhaCheckoutError, toCheckoutError } from './errors';
import { MODULE_NAME, type OpenOptions, type OpenOutcome, type Spec } from './NativeQasimhaCheckout';
import { parseReturnUrl, validateCheckoutOptions } from './returnUrl';
import type { CheckoutOptions, CheckoutResult, MerchantUrl } from './types';

export const RETURN_GRACE_MS = 300;

interface Pending {
  merchantUrl: MerchantUrl;
  native: Spec;
  resolve: (result: CheckoutResult) => void;
  reject: (error: QasimhaCheckoutError) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

let pending: Pending | null = null;

function nativeModule(): Spec | null {
  const turbo = TurboModuleRegistry.get<Spec>(MODULE_NAME);
  if (turbo) return turbo;
  const legacy = (NativeModules as Record<string, unknown>)[MODULE_NAME];
  return legacy ? (legacy as Spec) : null;
}

function release(entry: Pending): void {
  if (entry.timer !== null) clearTimeout(entry.timer);
  entry.timer = null;
  if (pending === entry) pending = null;
}

function finish(entry: Pending, result: CheckoutResult): void {
  if (pending !== entry) return;
  release(entry);
  entry.resolve(result);
}

function fail(entry: Pending, error: QasimhaCheckoutError): void {
  if (pending !== entry) return;
  release(entry);
  entry.reject(error);
}

function closeNative(native: Spec): void {
  try {
    Promise.resolve(native.close()).catch(() => undefined);
  } catch {
    return;
  }
}

function onOutcome(entry: Pending, outcome: OpenOutcome | null | undefined): void {
  if (pending !== entry) return;
  if (outcome && typeof outcome.url === 'string') {
    finish(entry, parseReturnUrl(outcome.url, entry.merchantUrl) ?? { type: 'failure', status: 'unknown' });
    return;
  }
  entry.timer = setTimeout(() => finish(entry, { type: 'cancelled' }), RETURN_GRACE_MS);
}

export function startCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
  let normalized;
  try {
    normalized = validateCheckoutOptions(options);
  } catch (error) {
    return Promise.reject(error);
  }
  const native = nativeModule();
  if (!native) {
    return Promise.reject(
      new QasimhaCheckoutError('NATIVE_MODULE_MISSING', 'QasimhaCheckout native module is not linked; rebuild the app after installing the package'),
    );
  }
  if (pending) return Promise.reject(new QasimhaCheckoutError('IN_PROGRESS', 'A checkout is already in progress'));

  return new Promise<CheckoutResult>((resolve, reject) => {
    const entry: Pending = { merchantUrl: normalized.merchantUrl, native, resolve, reject, timer: null };
    pending = entry;
    const presentation = Platform.OS === 'ios' ? normalized.presentation : 'systemBrowser';
    const openOptions: OpenOptions = { presentation };
    if (normalized.language) openOptions.language = normalized.language;
    if (presentation === 'webAuthenticationSession' && normalized.callback) {
      if ('scheme' in normalized.callback) {
        openOptions.callbackScheme = normalized.callback.scheme;
      } else {
        openOptions.callbackHost = normalized.callback.host;
        openOptions.callbackPath = normalized.callback.path;
      }
    }
    let opened: Promise<OpenOutcome>;
    try {
      opened = Promise.resolve(native.open(normalized.paymentUrl, openOptions));
    } catch (error) {
      fail(entry, toCheckoutError(error));
      return;
    }
    opened.then(
      (outcome) => onOutcome(entry, outcome),
      (error) => fail(entry, toCheckoutError(error)),
    );
  });
}

export function handleReturn(url: string): boolean {
  const entry = pending;
  if (!entry || typeof url !== 'string') return false;
  const result = parseReturnUrl(url, entry.merchantUrl);
  if (!result) return false;
  finish(entry, result);
  closeNative(entry.native);
  return true;
}

export function isCheckoutInProgress(): boolean {
  return pending !== null;
}
