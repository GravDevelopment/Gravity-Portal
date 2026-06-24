import { useState, useEffect, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';

function storageKey(accountId) {
  return `grav_prefs_${accountId}`;
}

const DEFAULTS = {
  theme: 'dark',
};

export function useUserPreferences() {
  const { accounts } = useMsal();
  const accountId = accounts[0]?.localAccountId ?? 'guest';

  const [prefs, setPrefsState] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey(accountId));
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  // re-load if account switches
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey(accountId));
      setPrefsState(stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS);
    } catch {
      setPrefsState(DEFAULTS);
    }
  }, [accountId]);

  const setPrefs = useCallback((updates) => {
    setPrefsState(prev => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem(storageKey(accountId), JSON.stringify(next)); } catch {}
      return next;
    });
  }, [accountId]);

  return { prefs, setPrefs };
}
