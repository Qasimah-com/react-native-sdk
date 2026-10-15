export type MerchantUrl = { success: string; failure: string; cancel: string };

export type Presentation = 'systemBrowser' | 'webAuthenticationSession';

export type Language = 'ar' | 'en';

export type CheckoutOptions = {
  paymentUrl: string;
  merchantUrl: MerchantUrl;
  presentation?: Presentation;
  language?: Language;
};

export type CheckoutResult =
  | { type: 'success'; orderId: string; orderReferenceId?: string }
  | { type: 'failure'; status: string; orderId?: string; orderReferenceId?: string }
  | { type: 'cancelled' };

export type ReturnKind = 'success' | 'failure' | 'cancel';
