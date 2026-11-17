const emailLocalPartPattern = /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i;
const emailDomainLabelPattern = /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i;
const emailTopLevelDomainPattern = /^(?:[A-Z]{2,63}|XN--[A-Z0-9-]{2,59})$/i;
const phonePattern = /^\+?[0-9][0-9\s().-]*$/;

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailAddress(value: string): boolean {
  const email = value.trim();
  if (email.length > 254) return false;

  const separator = email.indexOf('@');
  if (separator <= 0 || separator !== email.lastIndexOf('@')) return false;

  const localPart = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  if (localPart.length > 64 || !emailLocalPartPattern.test(localPart)) return false;

  const labels = domain.split('.');
  if (domain.length > 253 || labels.length < 2) return false;
  return labels.every((label) => label.length > 0 && label.length <= 63 && emailDomainLabelPattern.test(label))
    && emailTopLevelDomainPattern.test(labels[labels.length - 1]);
}

export function isValidPhoneNumber(value: string): boolean {
  const phone = value.trim();
  if (!phonePattern.test(phone)) return false;
  const digitCount = phone.replace(/\D/g, '').length;
  return digitCount >= 8 && digitCount <= 15;
}
