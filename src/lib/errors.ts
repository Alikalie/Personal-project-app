type ErrorDetails = {
  message?: string;
  code?: string;
  status?: number;
};

function detailsOf(error: unknown): ErrorDetails {
  if (typeof error !== 'object' || error === null) return {};
  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === 'string' ? record.message : undefined,
    code: typeof record.code === 'string' ? record.code : undefined,
    status: typeof record.status === 'number' ? record.status : undefined,
  };
}

export function friendlyErrorMessage(error: unknown): string {
  const { message = '', code = '', status } = detailsOf(error);
  const normalized = `${code} ${message}`.toLowerCase();

  const stockError = /not enough stock for (.+)|insufficient stock for (.+)/.exec(normalized);
  if (stockError) {
    return `Not enough stock for ${stockError[1] ?? stockError[2]}.`;
  }
  if (/not enough stock|insufficient stock|stock.*insufficient/.test(normalized)) {
    return 'Not enough stock. Check the available quantity and try again.';
  }
  if (/select a customer|customer.*credit|credit.*customer/.test(normalized)) {
    return 'Select a customer for a credit sale.';
  }
  if (/payments exceed|payment.*exceed.*total/.test(normalized)) {
    return 'Payments exceed the sale total.';
  }
  if (/invalid discount|discount.*invalid|discount cannot exceed/.test(normalized)) {
    return 'Invalid discount. It cannot exceed the sale subtotal.';
  }
  if (/23505|duplicate key|unique constraint/.test(normalized)) {
    if (/sku|barcode/.test(normalized)) {
      return 'That SKU or barcode is already used by another product.';
    }
    if (/category|business.*name/.test(normalized)) {
      return 'A category with this name already exists.';
    }
    return 'This item already exists.';
  }
  if (/42501|permission denied|not authorized|unauthorized/.test(normalized)) {
    return 'You do not have permission to make this change.';
  }
  if (/already registered|already exists|email_exists/.test(normalized)) {
    return 'An account with this email already exists. Log in or use a different email.';
  }
  if (/weak_password|password.*(weak|6 characters|too short)/.test(normalized)) {
    return 'Choose a stronger password with at least 6 characters.';
  }
  if (/rate.?limit|too many|over_email_send_rate_limit/.test(normalized) || status === 429) {
    return 'Too many attempts. Please wait a little while and try again.';
  }
  if (/network|fetch|internet|connection/.test(normalized) || error instanceof TypeError) {
    return 'No internet connection. Check your connection and try again.';
  }

  return message || 'Something went wrong. Please try again.';
}
