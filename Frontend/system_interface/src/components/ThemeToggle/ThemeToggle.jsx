import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import styles from './ThemeToggle.module.css';

/* ─── ThemeToggle ─────────────────────────────────────────────────────
 * Sun/Moon icon button. Matches the existing `.btn .btn-ghost` design
 * system, designed to slot into <Header actions={...} />.
 *
 * Shows the moon icon when in light mode (clicking will go dark),
 * shows the sun icon when in dark mode (clicking will go light).
 * ─────────────────────────────────────────────────────────────────── */

function SunIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.93 19.07 1.41-1.41" />
      <path d="m17.66 6.34 1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const nextLabel = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      id="btn-theme-toggle"
      onClick={toggleTheme}
      className={`btn btn-ghost ${styles.toggle}`}
      aria-label={nextLabel}
      title={nextLabel}
    >
      <span className={styles.iconWrap} key={theme /* re-trigger anim */}>
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}
