export const onboarding = {
  businessName: '',
  ownerName: '',
  businessType: '',
  address: '',
  phone: '',
  district: '',
  currencyCode: 'SLE',
};

export function clearOnboarding() {
  Object.assign(onboarding, {
    businessName: '',
    ownerName: '',
    businessType: '',
    address: '',
    phone: '',
    district: '',
    currencyCode: 'SLE',
  });
}
