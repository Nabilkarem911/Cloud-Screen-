/** ISO2 + display + dial + flag emoji — compact list; extend as needed. */
export type CountryOption = {
  code: string;
  name: string;
  dial: string;
  flag: string;
};

export const COUNTRIES: CountryOption[] = [
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
];

export function guessCountryCode(): string {
  if (typeof navigator === 'undefined') return 'US';
  const lang = navigator.language || 'en-US';
  const region = lang.split('-')[1]?.toUpperCase();
  if (region && COUNTRIES.some((c) => c.code === region)) return region;
  return 'US';
}
