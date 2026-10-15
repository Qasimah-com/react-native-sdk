import type { Language } from '../types';
import type { Plan } from './plans';

export interface PromoCopy {
  summary: string;
  interestFree: string;
  sharia: string;
  separator: string;
  currencyLabel: string;
  wordmark: string;
  learnMore: string;
}

export const COPY: Record<Language, PromoCopy> = {
  ar: {
    summary: 'قسّمها على {plan} بقيمة {money}',
    interestFree: 'بدون فوائد',
    sharia: 'متوافق مع الشريعة',
    separator: ' · ',
    currencyLabel: 'ريال',
    wordmark: 'قسّمها',
    learnMore: 'المزيد',
  },
  en: {
    summary: 'Split into {plan} of {money}',
    interestFree: 'Interest-free',
    sharia: 'Sharia-compliant',
    separator: ' · ',
    currencyLabel: 'SAR',
    wordmark: 'Qasimha',
    learnMore: 'Learn more',
  },
};

export function planPhrase(lang: Language, n: number, frequency: string): string {
  if (lang === 'en') {
    const word =
      frequency === 'monthly' ? 'monthly ' : frequency === 'weekly' ? 'weekly ' : frequency === 'biweekly' || frequency === 'fortnightly' ? 'fortnightly ' : '';
    return n + ' ' + word + (n === 1 ? 'payment' : 'payments');
  }
  let freq = '';
  if (frequency === 'monthly') freq = n === 2 ? 'شهريتين' : 'شهرية';
  else if (frequency === 'weekly') freq = n === 2 ? 'أسبوعيتين' : 'أسبوعية';
  else if (frequency === 'biweekly' || frequency === 'fortnightly') freq = 'كل أسبوعين';
  const suffix = freq ? ' ' + freq : '';
  if (n === 1) return 'دفعة واحدة' + suffix;
  if (n === 2) return 'دفعتين' + suffix;
  if (n <= 10) return n + ' دفعات' + suffix;
  return n + ' دفعة' + suffix;
}

export type SummaryPart = { kind: 'text'; text: string } | { kind: 'money' };

export function summaryParts(lang: Language, plan: Plan): SummaryPart[] {
  const sentence = COPY[lang].summary.replace('{plan}', planPhrase(lang, plan.instalments, plan.frequency));
  const parts: SummaryPart[] = [];
  for (const [index, text] of sentence.split('{money}').entries()) {
    if (index > 0) parts.push({ kind: 'money' });
    if (text) parts.push({ kind: 'text', text });
  }
  return parts;
}

export function trustLine(lang: Language, plan: Plan): string {
  if (!plan.shariaCompliant) return '';
  const copy = COPY[lang];
  return copy.interestFree + copy.separator + copy.sharia;
}

export function accessibilityLabel(lang: Language, plan: Plan, amountText: string): string {
  const copy = COPY[lang];
  const money = lang === 'ar' ? amountText + ' ' + copy.currencyLabel : copy.currencyLabel + ' ' + amountText;
  return copy.summary.replace('{plan}', planPhrase(lang, plan.instalments, plan.frequency)).replace('{money}', money);
}
