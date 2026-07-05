import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
export type Accent = 'emerald' | 'aurora' | 'sunset' | 'ocean';
export const ACCENTS: Accent[] = ['emerald', 'aurora', 'sunset', 'ocean'];

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  accent: Accent;
  setAccent: (a: Accent) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Theme is locked to light — dark mode is disabled app-wide.
  const theme: Theme = 'light';

  const [accent, setAccentState] = useState<Accent>(() => {
    const saved = localStorage.getItem('scc-accent') as Accent | null;
    return saved && ACCENTS.includes(saved) ? saved : 'emerald';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    localStorage.setItem('scc-theme', 'light');
  }, []);

  useEffect(() => {
    window.document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem('scc-accent', accent);
  }, [accent]);

  // No-op: theme is fixed to light.
  const toggleTheme = () => {};

  const setAccent = (a: Accent) => setAccentState(a);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
