export const supportedCurrencies = [
  { code: 'SLE', name: 'Sierra Leonean Leone' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'LRD', name: 'Liberian Dollar' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'NGN', name: 'Nigerian Naira' },
] as const;

export type SupportedCurrencyCode = (typeof supportedCurrencies)[number]['code'];
