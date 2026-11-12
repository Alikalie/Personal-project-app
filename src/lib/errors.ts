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

export function friendlyErrorMessage(error: unknown, context?: 'sale' | 'repayment' | 'repayment-record' | 'receipt' | 'admin'): string {
  const { message = '', code = '', status } = detailsOf(error);
  const normalized = `${code} ${message}`.toLowerCase();

  if (context === 'repayment-record') {
    if (/payment is more than the customer owes|payment.*more than.*customer owes/.test(normalized)) {
      return 'That payment is more than the customer owes.';
    }
    if (/amount.*(greater than zero|above zero|must be positive)|invalid amount/.test(normalized)) {
      return 'Enter an amount greater than zero.';
    }
    if (/42501|permission denied|not allowed|not authorized|unauthorized/.test(normalized)) {
      return 'You do not have permission.';
    }
    if (/network|fetch|internet|connection/.test(normalized) || error instanceof TypeError) {
      return 'No internet connection.';
    }
    return 'Could not record this payment. Please try again.';
  }

  if (context === 'repayment') {
    if (/payment is more than the customer owes|payment.*more than.*customer owes/.test(normalized)) {
      return 'That payment is more than the customer owes.';
    }
    if (/this payment was already changed|payment.*already changed/.test(normalized)) {
      return 'This payment was already changed.';
    }
    if (/reason is required|reason.*required|please give a reason/.test(normalized)) {
      return 'Please give a reason.';
    }
    if (/not allowed|42501|permission denied|not authorized|unauthorized/.test(normalized)) {
      return 'Only owners and managers can change payments.';
    }
    if (/network|fetch|internet|connection/.test(normalized) || error instanceof TypeError) {
      return 'No internet connection.';
    }
    return 'Could not change this payment. Please try again.';
  }
  if (context === 'admin') {
    if (/not allowed|42501|permission denied|not authorized|unauthorized/.test(normalized)) {
      return 'You do not have permission to use this admin action.';
    }
    if (/network|fetch|internet|connection/.test(normalized) || error instanceof TypeError) {
      return 'No internet connection. Check your connection and try again.';
    }
    return 'Could not load or update admin data. Please try again.';
  }

  const stockError = /not enough stock for (.+)|insufficient stock for (.+)/i.exec(message);
  if (stockError) {
    return `Not enough stock for ${stockError[1] ?? stockError[2]}.`;
  }
  if (/not enough stock|insufficient stock|stock.*insufficient/.test(normalized)) {
    return 'Not enough stock. Check the available quantity and try again.';
  }
  if (/select a customer|choose a customer|customer.*credit|credit.*customer/.test(normalized)) {
    return 'Choose a customer for a credit sale.';
  }
  if (/payments exceed|payments are more than|payment.*exceed.*total/.test(normalized)) {
    return 'Payments are more than the total.';
  }
  if (/invalid discount|discount.*invalid|discount cannot exceed|discount.*(too large|exceed)/.test(normalized)) {
    return 'Discount is too large.';
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
  if (/42501|permission denied|not authorized|unauthorized/.test(normalized) && context === 'sale') {
    return 'You do not have permission to sell.';
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
  if (context === 'receipt') {
    return 'Could not prepare this receipt. Please try again.';
  }

  return message || 'Something went wrong. Please try again.';
}
