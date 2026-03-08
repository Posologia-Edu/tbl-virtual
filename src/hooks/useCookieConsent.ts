import { useState, useCallback, useEffect } from 'react';

export type CookieCategory = 'essential' | 'functional' | 'analytics';

export type CookiePreferences = {
  essential: boolean; // always true
  functional: boolean;
  analytics: boolean;
  timestamp: string;
};

const STORAGE_KEY = 'cookie_consent';

const DEFAULT_PREFERENCES: CookiePreferences = {
  essential: true,
  functional: false,
  analytics: false,
  timestamp: '',
};

function getStoredPreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.timestamp) return { ...DEFAULT_PREFERENCES, ...parsed, essential: true };
    return null;
  } catch {
    return null;
  }
}

export function useCookieConsent() {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(() => getStoredPreferences());

  const hasConsented = preferences !== null && !!preferences.timestamp;

  const hasConsent = useCallback((category: CookieCategory): boolean => {
    if (category === 'essential') return true;
    if (!preferences) return false;
    return preferences[category] ?? false;
  }, [preferences]);

  const updateConsent = useCallback((prefs: Partial<Omit<CookiePreferences, 'essential' | 'timestamp'>>) => {
    const updated: CookiePreferences = {
      essential: true,
      functional: prefs.functional ?? false,
      analytics: prefs.analytics ?? false,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setPreferences(updated);
  }, []);

  const acceptAll = useCallback(() => {
    updateConsent({ functional: true, analytics: true });
  }, [updateConsent]);

  const acceptEssentialOnly = useCallback(() => {
    updateConsent({ functional: false, analytics: false });
  }, [updateConsent]);

  const resetConsent = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPreferences(null);
  }, []);

  return { preferences, hasConsented, hasConsent, updateConsent, acceptAll, acceptEssentialOnly, resetConsent };
}
