import { QasimhaCheckoutError } from './errors';
import type { CheckoutOptions, CheckoutResult, Language, MerchantUrl, Presentation, ReturnKind } from './types';

export interface ParsedUrl {
  scheme: string;
  hasAuthority: boolean;
  hasUserInfo: boolean;
  host: string;
  hostname: string;
  path: string;
  query: string;
  hasFragment: boolean;
}

export type Callback = { scheme: string } | { host: string; path: string };

export interface NormalizedOptions {
  paymentUrl: string;
  merchantUrl: MerchantUrl;
  presentation: Presentation;
  language?: Language;
  callback: Callback | null;
}

const URL_RE = /^([A-Za-z][A-Za-z0-9+.-]*):(\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(#[\s\S]*)?$/;
const RESERVED_SCHEMES: ReadonlySet<string> = new Set(['http', 'https', 'javascript', 'data', 'file', 'blob', 'vbscript']);
const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1']);
const PRESENTATIONS: ReadonlySet<string> = new Set<Presentation>(['systemBrowser', 'webAuthenticationSession']);
const LANGUAGES: ReadonlySet<string> = new Set<Language>(['ar', 'en']);
const RETURN_KINDS: readonly ReturnKind[] = ['success', 'failure', 'cancel'];
export const MAX_RETURN_URL_LENGTH = 1024;

export function parseUrl(input: string): ParsedUrl | null {
  if (typeof input !== 'string') return null;
  const match = URL_RE.exec(input.trim());
  if (!match) return null;
  const scheme = (match[1] ?? '').toLowerCase();
  const hasAuthority = match[2] !== undefined;
  const authority = match[3] ?? '';
  const at = authority.lastIndexOf('@');
  const hostPort = (at === -1 ? authority : authority.slice(at + 1)).toLowerCase();
  const hostname = hostPort.startsWith('[') ? hostPort.slice(0, hostPort.indexOf(']') + 1) : hostPort.replace(/:\d*$/, '');
  return {
    scheme,
    hasAuthority,
    hasUserInfo: at !== -1,
    host: hostPort,
    hostname,
    path: match[4] ?? '',
    query: match[5] ?? '',
    hasFragment: match[6] !== undefined,
  };
}

function normalizePath(path: string): string {
  return path === '' ? '/' : path;
}

export function matchesReturnUrl(candidate: ParsedUrl, merchant: ParsedUrl): boolean {
  if (candidate.scheme !== merchant.scheme || candidate.host !== merchant.host) return false;
  const base = normalizePath(merchant.path);
  const path = normalizePath(candidate.path);
  if (path === base) return true;
  return path.startsWith(base.endsWith('/') ? base : base + '/');
}

function decodeComponent(raw: string): string | null {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}

export function queryParams(query: string): Map<string, string> {
  const params = new Map<string, string>();
  if (!query) return params;
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decodeComponent(eq === -1 ? pair : pair.slice(0, eq));
    const value = decodeComponent(eq === -1 ? '' : pair.slice(eq + 1));
    if (key === null || value === null || params.has(key)) continue;
    params.set(key, value);
  }
  return params;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function failure(status: string, orderId: string | undefined, orderReferenceId: string | undefined): CheckoutResult {
  const result: CheckoutResult = { type: 'failure', status };
  if (orderId) result.orderId = orderId;
  if (orderReferenceId) result.orderReferenceId = orderReferenceId;
  return result;
}

export function resultFromReturnUrl(candidate: ParsedUrl, kind: ReturnKind): CheckoutResult {
  const params = queryParams(candidate.query);
  const orderId = nonEmpty(params.get('orderId'));
  const orderReferenceId = nonEmpty(params.get('orderReferenceId'));
  const status = (params.get('status') ?? '').trim().toLowerCase();
  if (status === 'confirmed') {
    if (!orderId) return failure('unknown', orderId, orderReferenceId);
    const result: CheckoutResult = { type: 'success', orderId };
    if (orderReferenceId) result.orderReferenceId = orderReferenceId;
    return result;
  }
  if (status === 'cancelled' || status === 'canceled') return { type: 'cancelled' };
  if (status === 'declined' || status === 'expired' || status === 'failed') return failure(status, orderId, orderReferenceId);
  if (status === '' && kind === 'cancel') return { type: 'cancelled' };
  return failure(status || 'unknown', orderId, orderReferenceId);
}

export function matchReturnUrl(url: string, merchantUrl: MerchantUrl): { kind: ReturnKind; url: ParsedUrl } | null {
  const candidate = parseUrl(url);
  if (!candidate) return null;
  for (const kind of RETURN_KINDS) {
    const merchant = parseUrl(merchantUrl[kind]);
    if (merchant && matchesReturnUrl(candidate, merchant)) return { kind, url: candidate };
  }
  return null;
}

export function parseReturnUrl(url: string, merchantUrl: MerchantUrl): CheckoutResult | null {
  const match = matchReturnUrl(url, merchantUrl);
  return match ? resultFromReturnUrl(match.url, match.kind) : null;
}

function invalid(field: string, message: string): QasimhaCheckoutError {
  return new QasimhaCheckoutError('INVALID_OPTIONS', `${field} ${message}`, field);
}

export function isCustomScheme(scheme: string): boolean {
  return !RESERVED_SCHEMES.has(scheme) && scheme.length >= 3;
}

export function validateReturnUrl(value: unknown, field: string): ParsedUrl {
  if (typeof value !== 'string' || value.trim() === '') throw invalid(field, 'is required');
  const url = value.trim();
  if (url.length > MAX_RETURN_URL_LENGTH) throw invalid(field, `must be at most ${MAX_RETURN_URL_LENGTH} characters`);
  if (url.includes('#')) throw invalid(field, 'must not carry a fragment');
  const parsed = parseUrl(url);
  if (!parsed) throw invalid(field, 'must be an absolute URL');
  const web = parsed.scheme === 'http' || parsed.scheme === 'https';
  if (web && parsed.hostname === '') throw invalid(field, 'must name a host');
  const allowed =
    parsed.scheme === 'https' || (parsed.scheme === 'http' && LOCAL_HOSTNAMES.has(parsed.hostname)) || isCustomScheme(parsed.scheme);
  if (!allowed) throw invalid(field, 'must use https, http on localhost or 127.0.0.1, or a custom app scheme');
  return parsed;
}

export function validatePaymentUrl(value: unknown): string {
  const field = 'paymentUrl';
  if (typeof value !== 'string' || value.trim() === '') throw invalid(field, 'is required');
  const url = value.trim();
  const parsed = parseUrl(url);
  if (!parsed || parsed.scheme !== 'https' || parsed.hostname === '') throw invalid(field, 'must be an absolute https URL');
  if (parsed.hasUserInfo) throw invalid(field, 'must not carry credentials');
  return url;
}

function deriveCallback(urls: Record<ReturnKind, ParsedUrl>): Callback {
  const list = RETURN_KINDS.map((kind) => urls[kind]);
  const first = list[0] as ParsedUrl;
  if (isCustomScheme(first.scheme)) {
    if (list.every((url) => url.scheme === first.scheme)) return { scheme: first.scheme };
  } else if (first.scheme === 'https') {
    const path = normalizePath(first.path);
    if (list.every((url) => url.scheme === 'https' && url.hostname === first.hostname && normalizePath(url.path) === path)) {
      return { host: first.hostname, path };
    }
  }
  throw invalid('merchantUrl', 'must share one custom scheme, or one https host and path, when presentation is webAuthenticationSession');
}

export function validateCheckoutOptions(options: unknown): NormalizedOptions {
  if (typeof options !== 'object' || options === null) throw invalid('options', 'must be an object');
  const raw = options as Partial<CheckoutOptions> & Record<string, unknown>;
  const paymentUrl = validatePaymentUrl(raw.paymentUrl);
  if (typeof raw.merchantUrl !== 'object' || raw.merchantUrl === null) throw invalid('merchantUrl', 'is required');
  const merchant = raw.merchantUrl as Record<string, unknown>;
  const parsed = {} as Record<ReturnKind, ParsedUrl>;
  const merchantUrl = {} as MerchantUrl;
  for (const kind of RETURN_KINDS) {
    parsed[kind] = validateReturnUrl(merchant[kind], `merchantUrl.${kind}`);
    merchantUrl[kind] = (merchant[kind] as string).trim();
  }
  let presentation: Presentation = 'systemBrowser';
  if (raw.presentation !== undefined) {
    if (typeof raw.presentation !== 'string' || !PRESENTATIONS.has(raw.presentation)) {
      throw invalid('presentation', 'must be systemBrowser or webAuthenticationSession');
    }
    presentation = raw.presentation as Presentation;
  }
  const normalized: NormalizedOptions = { paymentUrl, merchantUrl, presentation, callback: null };
  if (raw.language !== undefined) {
    if (typeof raw.language !== 'string' || !LANGUAGES.has(raw.language)) throw invalid('language', 'must be ar or en');
    normalized.language = raw.language as Language;
  }
  if (presentation === 'webAuthenticationSession') normalized.callback = deriveCallback(parsed);
  return normalized;
}
