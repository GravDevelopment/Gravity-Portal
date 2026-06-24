import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useMsal } from '@azure/msal-react';

const ThemeContext = createContext();

function storageKey(accountId) {
  return `grav_prefs_${accountId ?? 'guest'}`;
}

function loadTheme(accountId) {
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    if (raw) return JSON.parse(raw).theme ?? 'light';
  } catch {}
  // fall back to OS preference
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function saveTheme(accountId, theme) {
  try {
    const key = storageKey(accountId);
    const existing = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...existing, theme }));
  } catch {}
}

export function ThemeProvider({ children }) {
  const { accounts } = useMsal();
  const accountId = accounts[0]?.localAccountId ?? null;

  const [isDark, setIsDark] = useState(() => loadTheme(accountId) === 'dark');

  // re-load when the signed-in account changes
  useEffect(() => {
    setIsDark(loadTheme(accountId) === 'dark');
  }, [accountId]);

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      saveTheme(accountId, next ? 'dark' : 'light');
      return next;
    });
  }, [accountId]);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
