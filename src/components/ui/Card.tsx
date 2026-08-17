import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  animate?: boolean;
  delay?: number;
  glass?: boolean;
  /** What the card MEANS, rather than a hand-picked border colour. */
  tone?: CardTone;
}

// ─── The card ─────────────────────────────────────────────────────────────────
// 71 files hand-rolled their own bordered container against 20 using this one,
// which is why no two screens quite matched. This is now the single card in the
// app — every surface that holds content is one of these.
//
// `tone` covers what the hand-rolled versions were actually reaching for when
// they went their own way: a plain surface, a soft state colour, or a bare
// outline. Having them here means a screen picks a MEANING rather than
// re-inventing a border.

export type CardTone = 'plain' | 'good' | 'warn' | 'bad' | 'quiet';

const TONES: Record<CardTone, string> = {
  plain: 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10',
  good:  'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-400/25',
  warn:  'bg-amber-50/70 dark:bg-amber-500/10 border-amber-200 dark:border-amber-400/25',
  bad:   'bg-rose-50/70 dark:bg-rose-500/10 border-rose-200 dark:border-rose-400/25',
  quiet: 'bg-transparent border-slate-200 dark:border-white/10',
};

export function Card({ children, className = '', onClick, hover = false, animate = true, delay = 0, glass = false, tone = 'plain' }: CardProps) {
  const baseClasses = glass
    ? 'bg-white/80 dark:bg-gray-900/70 backdrop-blur-md r-card shadow-lg border border-white/20 dark:border-white/10'
    : `r-card shadow-sm border ${TONES[tone]}`;

  const hoverClasses = hover || onClick
    ? 'hover:shadow-lg hover:scale-[1.02] hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer active:scale-[0.98]'
    : '';

  const animateClasses = animate ? 'animate-fade-in-up' : '';
  const animationDelay = delay > 0 ? { animationDelay: `${delay}ms`, animationFillMode: 'backwards' as const } : {};

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${animateClasses} transition-all duration-300 ${className}`}
      style={animationDelay}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-5 py-3.5 border-b border-slate-200 dark:border-white/10 ${className}`}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`px-5 py-3.5 border-t border-slate-200 dark:border-white/10 ${className}`}>
      {children}
    </div>
  );
}
