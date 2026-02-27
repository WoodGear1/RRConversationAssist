// i18n configuration and utilities
// Default language: Russian (ru)
// Structure ready for adding English (en) and other languages

export type Locale = 'ru' | 'en';

export const defaultLocale: Locale = 'ru';
export const supportedLocales: Locale[] = ['ru', 'en'];

export interface Translations {
  [key: string]: string | Translations;
}

// Translation namespaces
export type Namespace = 
  | 'common'
  | 'auth'
  | 'recordings'
  | 'search'
  | 'templates'
  | 'settings'
  | 'errors';

// Load translations for a specific locale and namespace
export async function loadTranslations(
  locale: Locale,
  namespace: Namespace
): Promise<Translations> {
  try {
    const module = await import(`./locales/${locale}/${namespace}.json`);
    return module.default;
  } catch (error) {
    // Fallback to default locale if translation not found
    if (locale !== defaultLocale) {
      try {
        const module = await import(`./locales/${defaultLocale}/${namespace}.json`);
        return module.default;
      } catch {
        return {};
      }
    }
    return {};
  }
}

// Get translation by key (supports nested keys like 'common.buttons.save')
export function t(
  translations: Translations,
  key: string,
  params?: Record<string, string | number>
): string {
  const keys = key.split('.');
  let value: any = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key if translation not found
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Replace parameters
  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
      return params[paramKey]?.toString() || match;
    });
  }

  return value;
}

// Format date according to locale
export function formatDate(date: Date | string, locale: Locale = defaultLocale): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}

// Format number according to locale
export function formatNumber(
  value: number,
  locale: Locale = defaultLocale,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', options).format(value);
}

// Format duration in milliseconds to human-readable format
export function formatDuration(ms: number, locale: Locale = defaultLocale): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (locale === 'ru') {
    if (hours > 0) {
      return `${hours}ч ${minutes % 60}м`;
    }
    return `${minutes}м`;
  } else {
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }
}
