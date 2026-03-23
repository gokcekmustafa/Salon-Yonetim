const TURKISH_CHAR_MAP: Record<string, string> = {
  'ş': 's', 'Ş': 's',
  'ğ': 'g', 'Ğ': 'g',
  'ü': 'u', 'Ü': 'u',
  'ö': 'o', 'Ö': 'o',
  'ç': 'c', 'Ç': 'c',
  'ı': 'i', 'İ': 'i',
};

/**
 * Sanitizes a username input:
 * - Converts Turkish characters to English equivalents
 * - Lowercases everything
 * - Replaces spaces with underscores
 * - Strips any character that isn't a-z, 0-9, dot, or underscore
 */
export function sanitizeUsername(value: string): string {
  let result = '';
  for (const ch of value) {
    result += TURKISH_CHAR_MAP[ch] ?? ch;
  }
  return result
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/[._]{2,}/g, (m) => m[0]) // collapse consecutive dots/underscores
    .slice(0, 32);
}
