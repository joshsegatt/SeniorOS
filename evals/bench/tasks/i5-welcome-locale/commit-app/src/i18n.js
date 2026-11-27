export const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'pt'];
export const DEFAULT_LANGUAGE = 'en';

// 'pt-BR' | 'pt_BR' | 'PT' -> 'pt'; unsupported or missing -> 'en'.
export function resolveLanguage(locale) {
  if (typeof locale !== 'string' || locale.trim() === '') return DEFAULT_LANGUAGE;
  const base = locale.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(base) ? base : DEFAULT_LANGUAGE;
}
