export type QasimhaCheckoutErrorCode =
  | 'INVALID_OPTIONS'
  | 'IN_PROGRESS'
  | 'NATIVE_MODULE_MISSING'
  | 'INVALID_URL'
  | 'NO_ACTIVITY'
  | 'NO_BROWSER'
  | 'NO_VIEW_CONTROLLER'
  | 'UNSUPPORTED'
  | 'PRESENTATION_FAILED'
  | 'HOST_DESTROYED'
  | 'NATIVE_ERROR';

const NATIVE_CODES: ReadonlySet<string> = new Set<QasimhaCheckoutErrorCode>([
  'IN_PROGRESS',
  'INVALID_URL',
  'NO_ACTIVITY',
  'NO_BROWSER',
  'NO_VIEW_CONTROLLER',
  'UNSUPPORTED',
  'PRESENTATION_FAILED',
  'HOST_DESTROYED',
]);

export class QasimhaCheckoutError extends Error {
  readonly code: QasimhaCheckoutErrorCode;
  readonly field?: string;

  constructor(code: QasimhaCheckoutErrorCode, message: string, field?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'QasimhaCheckoutError';
    this.code = code;
    if (field !== undefined) this.field = field;
  }
}

export function toCheckoutError(reason: unknown): QasimhaCheckoutError {
  if (reason instanceof QasimhaCheckoutError) return reason;
  const record = typeof reason === 'object' && reason !== null ? (reason as { code?: unknown; message?: unknown }) : {};
  const code = typeof record.code === 'string' && NATIVE_CODES.has(record.code) ? (record.code as QasimhaCheckoutErrorCode) : 'NATIVE_ERROR';
  const message = typeof record.message === 'string' && record.message ? record.message : 'The native checkout module failed';
  return new QasimhaCheckoutError(code, message);
}
