'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Locale } from './translations';

interface I18nContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
  formatCurrency: (value: number) => string;
  formatDateTime: (value: string | Date) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('ko');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('workstation-locale');
    // Defer state updates to next tick to avoid synchronous setState inside useEffect warnings
    setTimeout(() => {
      if (saved === 'en' || saved === 'ko') {
        setLocaleState(saved as Locale);
      } else {
        // Default to ko
        localStorage.setItem('workstation-locale', 'ko');
      }
      setMounted(true);
    }, 0);
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('workstation-locale', newLocale);
  };

  const t = (key: string, variables?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let dict: unknown = translations[locale];

    for (const k of keys) {
      if (dict && typeof dict === 'object' && k in (dict as Record<string, unknown>)) {
        dict = (dict as Record<string, unknown>)[k];
      } else {
        // Fallback to English dictionary if key missing in current locale
        let fallbackDict: unknown = translations['en'];
        for (const fk of keys) {
          if (fallbackDict && typeof fallbackDict === 'object' && fk in (fallbackDict as Record<string, unknown>)) {
            fallbackDict = (fallbackDict as Record<string, unknown>)[fk];
          } else {
            fallbackDict = null;
            break;
          }
        }
        if (typeof fallbackDict === 'string') {
          dict = fallbackDict;
          break;
        }
        return key;
      }
    }

    if (typeof dict !== 'string') {
      return key;
    }

    let result = dict;
    if (variables) {
      Object.entries(variables).forEach(([name, val]) => {
        result = result.replace(new RegExp(`{${name}}`, 'g'), String(val));
      });
    }

    return result;
  };

  const formatCurrency = (value: number): string => {
    if (isNaN(value)) value = 0;
    const formatted = Math.round(value).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US');
    return locale === 'ko' ? `${formatted}원` : `${formatted} KRW`;
  };

  const formatDateTime = (value: string | Date): string => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    // Force Asia/Seoul time zone for Korean broker display consistency
    if (locale === 'ko') {
      return new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date);
    } else {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date);
    }
  };

  // Prevent hydration layout mismatch while loading preferred language from localStorage
  if (!mounted) {
    return (
      <I18nContext.Provider value={{ locale: 'ko', setLocale, t, formatCurrency, formatDateTime }}>
        <div style={{ display: 'none' }} aria-hidden="true">
          {children}
        </div>
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, formatCurrency, formatDateTime }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
