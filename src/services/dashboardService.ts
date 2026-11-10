import { onboarding } from './onboardingStore';

export async function getBusiness() {
  return {
    name: onboarding.businessName || 'SaloneBiz',
  };
}

export async function getDashboard() {
  return {
    todaySales: 1245000,
    salesChangePct: 18,
    grossProfit: 456000,
    totalProducts: 142,
    lowStock: 8,
    outstandingDebts: 215000,
    weekSales: [
      { day: 'Mon', value: 940000 },
      { day: 'Tue', value: 1030000 },
      { day: 'Wed', value: 980000 },
      { day: 'Thu', value: 1180000 },
      { day: 'Fri', value: 1360000 },
      { day: 'Sat', value: 1490000 },
      { day: 'Sun', value: 1245000 },
    ],
    recentTransactions: [
      { id: '1', customer: 'Mariam Conteh', items: 3, method: 'Cash', time: '08:20', total: 540000 },
      { id: '2', customer: 'Musa Bangura', items: 5, method: 'Transfer', time: '10:45', total: 820000 },
      { id: '3', customer: 'Hawa Sesay', items: 2, method: 'Credit', time: '12:10', total: 310000 },
      { id: '4', customer: 'Francis Koroma', items: 4, method: 'Cash', time: '15:30', total: 470000 },
    ],
  };
}
