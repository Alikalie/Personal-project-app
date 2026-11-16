export const planUsageMetrics = [
  { id: 'products', label: 'Products' },
  { id: 'team', label: 'Team members' },
  { id: 'monthly_sales', label: 'Sales per month' },
  { id: 'customers', label: 'Customers' },
] as const;

export type PlanUsageMetric = (typeof planUsageMetrics)[number]['id'];
export type PlanLimits = Record<PlanUsageMetric, number | null>;

export const defaultPlanLimits: PlanLimits = {
  products: null,
  team: null,
  monthly_sales: null,
  customers: null,
};

export type PlanId = 'starter' | 'business' | 'pro';

export type SubscriptionPlanSettings = {
  monthlyPriceMinor: number;
  limits: PlanLimits;
};

export type SubscriptionSettings = {
  enabled: boolean;
  priceCurrencyCode: 'SLE';
  plans: Record<PlanId, SubscriptionPlanSettings>;
};

export function getDefaultSubscriptionSettings(): SubscriptionSettings {
  return {
    enabled: false,
    priceCurrencyCode: 'SLE',
    plans: {
      starter: { monthlyPriceMinor: 0, limits: { ...defaultPlanLimits } },
      business: { monthlyPriceMinor: 0, limits: { ...defaultPlanLimits } },
      pro: { monthlyPriceMinor: 0, limits: { ...defaultPlanLimits } },
    },
  };
}

export function parseSubscriptionSettings(value: unknown): SubscriptionSettings {
  const defaults = getDefaultSubscriptionSettings();
  if (typeof value !== 'object' || value === null) return defaults;
  const row = value as Record<string, unknown>;
  const plansValue = typeof row.plans === 'object' && row.plans !== null
    ? row.plans as Record<string, unknown>
    : {};

  const plans = Object.fromEntries(
    (Object.keys(defaults.plans) as PlanId[]).map((id) => {
      const saved = typeof plansValue[id] === 'object' && plansValue[id] !== null
        ? plansValue[id] as Record<string, unknown>
        : {};
      const savedLimits = typeof saved.limits === 'object' && saved.limits !== null
        ? saved.limits as Record<string, unknown>
        : {};
      const limits = Object.fromEntries(planUsageMetrics.map(({ id: metric }) => {
        const limit = savedLimits[metric];
        return [
          metric,
          limit === null || limit === undefined
            ? null
            : Number.isSafeInteger(limit) && Number(limit) >= 0
              ? Number(limit)
              : defaults.plans[id].limits[metric],
        ];
      })) as PlanLimits;
      const price = saved.monthlyPriceMinor;
      return [id, {
        monthlyPriceMinor: Number.isSafeInteger(price) && Number(price) >= 0
          ? Number(price)
          : defaults.plans[id].monthlyPriceMinor,
        limits,
      }];
    }),
  ) as Record<PlanId, SubscriptionPlanSettings>;

  return {
    enabled: row.enabled === true,
    priceCurrencyCode: 'SLE',
    plans,
  };
}
