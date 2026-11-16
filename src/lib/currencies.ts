import { countries } from 'countries-list';
import { currencies } from 'countries-list/currencies';
import type { TCurrencyCode } from 'countries-list';

export type SupportedCurrency = {
  code: string;
  name: string;
  countries: string[];
};

const countryNamesByCurrency = new Map<TCurrencyCode, Set<string>>();

for (const country of Object.values(countries)) {
  if (country.userAssigned) continue;
  for (const code of country.currency) {
    const currency = currencies[code];
    if (!currency || currency.withdrawn || code === 'XXX') continue;
    const countryNames = countryNamesByCurrency.get(code) ?? new Set<string>();
    countryNames.add(country.name);
    countryNamesByCurrency.set(code, countryNames);
  }
}

const preferredOrder = ['SLE', 'USD', 'EUR', 'GBP', 'LRD', 'GHS', 'NGN'];

export const supportedCurrencies: SupportedCurrency[] = [...countryNamesByCurrency]
  .map(([code, countryNames]) => ({
    code,
    name: currencies[code].name,
    countries: [...countryNames].sort((a, b) => a.localeCompare(b)),
  }))
  .sort((a, b) => {
    const aOrder = preferredOrder.indexOf(a.code);
    const bOrder = preferredOrder.indexOf(b.code);
    if (aOrder !== -1 || bOrder !== -1) {
      return (aOrder === -1 ? Number.MAX_SAFE_INTEGER : aOrder)
        - (bOrder === -1 ? Number.MAX_SAFE_INTEGER : bOrder);
    }
    return a.name.localeCompare(b.name);
  });

export type SupportedCurrencyCode = (typeof supportedCurrencies)[number]['code'];
