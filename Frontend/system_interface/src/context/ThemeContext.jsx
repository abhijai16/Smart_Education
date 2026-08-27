import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

/* ─── ThemeContext ────────────────────────────────────────────────────
 * Provides app-wide theme state ('dark' | 'light') and a toggleTheme
 * action. Persists choice to localStorage. Does NOT touch <html> —
 * instead, ThemedApp wrapper reads `theme` and renders a div with
 * data-theme on it. CSS scopes overrides to `.app-themed[data-theme]`,
 * which keeps Landing/Login/Register (which are not wrapped) unaffected.
 *
 * Defaults to the user's OS preference on first load if no saved choice.
 * ─────────────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'quorum:theme';
const VALID_THEMES = ['dark', 'light'];

const ThemeContext = createContext(null);

function getInitialTheme() {
  // 1. Saved choice wins
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (VALID_THEMES.includes(saved)) return saved;
  } catch {
    // localStorage may be unavailable (private mode, SSR, etc.)
  }
  // 2. Fall back to OS preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  }
  // 3. Default — the app is designed dark-first
  return 'dark';
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  // Persist the choice. The DOM attribute is owned by <ThemedApp>,
  // which is the only thing that actually mounts themed content.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore storage failures */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setThemeExplicit = useCallback((next) => {
    if (VALID_THEMES.includes(next)) setTheme(next);
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme: setThemeExplicit }),
    [theme, toggleTheme, setThemeExplicit]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

/* ThemedApp — wrapper that applies the theme via a data-theme attribute
 * on a class-scoped div. Use this anywhere you want the theme tokens
 * to override defaults. In the app, ProtectedRoute renders it around
 * authenticated children, so the toggle only affects post-login pages.
 */
export const ThemedApp = ({ children, className = '', ...rest }) => {
  const { theme } = useTheme();
  return (
    <div
      className={`app-themed ${className}`.trim()}
      data-theme={theme}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      {...rest}
    >
      {children}
    </div>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};

export default ThemeContext;
