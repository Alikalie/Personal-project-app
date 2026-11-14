export function safeHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeContactUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) return url.toString();
    if (url.protocol === 'mailto:' && /^[^\s@?]+@[^\s@?]+\.[^\s@?]+$/.test(url.pathname)) return url.toString();
    if (url.protocol === 'tel:' && /^\+?\d{7,15}$/.test(url.pathname)) return url.toString();
    return null;
  } catch {
    return null;
  }
}
