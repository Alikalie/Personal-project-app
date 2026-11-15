export const safeLogger = {
  log: (...args: Parameters<typeof console.log>) => {
    if (__DEV__) console.log(...args);
  },
  info: (...args: Parameters<typeof console.info>) => {
    if (__DEV__) console.info(...args);
  },
  warn: (...args: Parameters<typeof console.warn>) => {
    if (__DEV__) console.warn(...args);
  },
  error: (...args: Parameters<typeof console.error>) => {
    if (__DEV__) console.error(...args);
  },
  debug: (...args: Parameters<typeof console.debug>) => {
    if (__DEV__) console.debug(...args);
  },
};
