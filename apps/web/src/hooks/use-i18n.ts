'use client'

import { useState, useEffect, useMemo } from 'react';
import { Locale, Namespace, loadTranslations, t as translate, Translations } from '@/lib/i18n';

export function useI18n(namespace: Namespace, locale: Locale = 'ru') {
  const [translations, setTranslations] = useState<Translations>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTranslations(locale, namespace).then((loaded) => {
      setTranslations(loaded);
      setLoading(false);
    });
  }, [locale, namespace]);

  const t = useMemo(
    () => (key: string, params?: Record<string, string | number>) =>
      translate(translations, key, params),
    [translations]
  );

  return { t, loading, locale };
}
