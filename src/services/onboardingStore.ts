export const onboarding = {
  businessName: '',
  ownerName: '',
  businessType: '',
  address: '',
  phone: '',
  district: '',
};

export function clearOnboarding() {
  Object.assign(onboarding, {
    businessName: '',
    ownerName: '',
    businessType: '',
    address: '',
    phone: '',
    district: '',
  });
}
