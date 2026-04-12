/** Heuristic: use RTL marquee when Arabic letters dominate the ticker string. */
export function isPrimarilyArabicScript(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  let arabic = 0;
  let latin = 0;
  for (const ch of t) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0600 && cp <= 0x06ff) arabic += 1;
    else if (
      (cp >= 0x0041 && cp <= 0x024f) ||
      (cp >= 0x0030 && cp <= 0x0039) ||
      (cp >= 0x0020 && cp <= 0x0040)
    ) {
      latin += 1;
    }
  }
  return arabic > 0 && arabic >= latin;
}
