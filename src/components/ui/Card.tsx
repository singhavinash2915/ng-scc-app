import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  animate?: boolean;
  delay?: number;
  glass?: boolean;
}

export function Card({ children, className = '', onClick, hover = false, animate = true, delay = 0, glass = false }: CardProps) {
  const baseClasses = glass
    ? 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/50'
    : 'bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700';

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
    <div className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 ${className}`}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`px-6 py-4 border-t border-gray-200 dark:border-gray-700 ${className}`}>
      {children}
    </div>
  );
}
