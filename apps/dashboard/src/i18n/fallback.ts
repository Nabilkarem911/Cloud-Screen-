import en from './messages/en.json';

/**
 * Structured marker for missing translations.
 * This keeps locale rendering consistent and makes gaps visible during QA.
 */
export function getMissingMessageMarker(
  namespace: string | undefined,
  key: string,
): string {
  return `[missing:${namespace ? `${namespace}.` : ''}${key}]`;
}

/**
 * Optional EN dictionary lookup used only when current locale is English.
 */
export function getEnglishFallbackString(
  namespace: string | undefined,
  key: string,
): string {
  try {
    if (namespace) {
      const root = (en as Record<string, unknown>)[namespace];
      if (root && typeof root === 'object') {
        const parts = key.split('.');
        let cur: unknown = root;
        for (const p of parts) {
          if (!cur || typeof cur !== 'object') break;
          cur = (cur as Record<string, unknown>)[p];
        }
        if (typeof cur === 'string') return cur;
      }
    } else if (key in (en as Record<string, unknown>)) {
      const v = (en as Record<string, unknown>)[key];
      if (typeof v === 'string') return v;
    }
  } catch {
    /* ignore */
  }
  return getMissingMessageMarker(namespace, key);
}

/**
 * Locale-aware fallback:
 * - For `en`, use English dictionary fallback.
 * - For non-`en`, never inject English copy; show missing marker.
 */
export function getLocaleAwareFallbackString(
  locale: string,
  namespace: string | undefined,
  key: string,
): string {
  if (locale === 'en') {
    return getEnglishFallbackString(namespace, key);
  }
  return getMissingMessageMarker(namespace, key);
}
