export const minimumPasswordLength = 8;

export function passwordPolicyError(password: string): string | null {
  if (password.length < minimumPasswordLength) {
    return 'Use at least 8 characters.';
  }
  if (!/[!-/:-@[-`{-~]/.test(password)) {
    return 'Include at least one special character or symbol, such as ! or #.';
  }
  return null;
}
