import { parseUrl } from '../returnUrl';
import type { Language } from '../types';

export interface Plan {
  instalments: number;
  frequency: string;
  instalmentAmount: number;
  firstInstalmentAmount: number;
  lastInstalmentAmount: number;
  feesIncludingVat: number;
  totalPayable: number;
  shariaCompliant: boolean;
}

export interface PlansData {
  merchantName: string;
  currency: 'SAR';
  minAmount: number;
  maxAmount: number;
  plans: Plan[];
}

export interface PlansRequest {
  apiBaseUrl: string;
  publicKey: string;
  amount: number;
  lang: Language;
  signal?: AbortSignal;
}

export const PUBLIC_KEY_RE = /^pk_(test|live)_[A-Za-z0-9]+$/;
const LIVE_API = 'https://api.qasimha.com';
const TEST_API = 'https://merchant-api-uat.qasimha.com';
const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);
const PLANS_PATH = '/api/v1/widget/plans';
const AMOUNT_RE = /^\d{1,9}(\.\d{1,2})?$/;
const TIMEOUT_MS = 5000;

export function defaultApiBaseUrl(publicKey: string): string {
  return publicKey.startsWith('pk_live_') ? LIVE_API : TEST_API;
}

export function normalizeApiBaseUrl(value: unknown, publicKey: string): string | null {
  if (value === undefined || value === null || value === '') return defaultApiBaseUrl(publicKey);
  if (typeof value !== 'string') return null;
  const url = parseUrl(value);
  if (!url || !url.hasAuthority || url.hostname === '' || url.hasUserInfo || url.query || url.hasFragment) return null;
  const local = LOCAL_HOSTNAMES.has(url.hostname);
  if (url.scheme !== 'https' && !(url.scheme === 'http' && local)) return null;
  return url.scheme + '://' + url.host + url.path.replace(/\/+$/, '');
}

export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!isFinite(value) || value <= 0 || value > 999999999.99) return null;
    const halalas = value * 100;
    return Math.abs(halalas - Math.round(halalas)) < 1e-6 ? Math.round(halalas) / 100 : null;
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!AMOUNT_RE.test(text)) return null;
  const n = Number(text);
  return isFinite(n) && n > 0 ? n : null;
}

export function amountParam(n: number): string {
  return n.toFixed(2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function money(value: unknown): number | null {
  return typeof value === 'number' && isFinite(value) && value >= 0 ? value : null;
}

function parsePlan(raw: unknown): Plan | null {
  if (!isRecord(raw)) return null;
  const instalments = raw.instalments;
  if (typeof instalments !== 'number' || !Number.isInteger(instalments) || instalments < 1 || instalments > 60) return null;
  const instalmentAmount = money(raw.instalmentAmount);
  const totalPayable = money(raw.totalPayable);
  if (instalmentAmount === null || totalPayable === null) return null;
  const first = raw.firstInstalmentAmount === undefined ? instalmentAmount : money(raw.firstInstalmentAmount);
  const last = raw.lastInstalmentAmount === undefined ? instalmentAmount : money(raw.lastInstalmentAmount);
  const fees = raw.feesIncludingVat === undefined ? 0 : money(raw.feesIncludingVat);
  if (first === null || last === null || fees === null) return null;
  return {
    instalments,
    frequency: typeof raw.frequency === 'string' ? raw.frequency.toLowerCase() : 'monthly',
    instalmentAmount,
    firstInstalmentAmount: first,
    lastInstalmentAmount: last,
    feesIncludingVat: fees,
    totalPayable,
    shariaCompliant: raw.shariaCompliant === true,
  };
}

export function parsePlans(body: unknown, amount: number): PlansData | null {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) return null;
  const data = body.data;
  if (data.currency !== 'SAR') return null;
  const minAmount = money(data.minAmount);
  const maxAmount = money(data.maxAmount);
  if (minAmount === null || maxAmount === null || amount < minAmount || amount > maxAmount) return null;
  if (!Array.isArray(data.plans)) return null;
  const plans: Plan[] = [];
  for (const raw of data.plans) {
    const plan = parsePlan(raw);
    if (plan) plans.push(plan);
  }
  if (plans.length === 0) return null;
  return {
    merchantName: typeof data.merchantName === 'string' ? data.merchantName : '',
    currency: 'SAR',
    minAmount,
    maxAmount,
    plans,
  };
}

export function plansUrl(apiBaseUrl: string, amount: number, lang: Language): string {
  return apiBaseUrl + PLANS_PATH + '?amount=' + amountParam(amount) + '&currency=SAR&lang=' + lang;
}

export async function fetchPlans(request: PlansRequest): Promise<PlansData | null> {
  if (typeof fetch !== 'function') return null;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
  const onOuterAbort = controller ? () => controller.abort() : null;
  if (request.signal && onOuterAbort) {
    if (request.signal.aborted) onOuterAbort();
    else request.signal.addEventListener('abort', onOuterAbort);
  }
  try {
    const response = await fetch(plansUrl(request.apiBaseUrl, request.amount, request.lang), {
      method: 'GET',
      headers: { 'X-Public-Key': request.publicKey, Accept: 'application/json' },
      credentials: 'omit',
      signal: controller ? controller.signal : undefined,
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return parsePlans(body, request.amount);
  } catch {
    return null;
  } finally {
    if (timer !== null) clearTimeout(timer);
    if (request.signal && onOuterAbort) request.signal.removeEventListener('abort', onOuterAbort);
  }
}
