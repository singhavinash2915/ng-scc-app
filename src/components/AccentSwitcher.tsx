import { useTheme, ACCENTS, type Accent } from '../context/ThemeContext';

const SWATCH: Record<Accent, { label: string; grad: string }> = {
  emerald: { label: 'Emerald', grad: 'linear-gradient(135deg,#10b981,#2dd4bf)' },
  aurora:  { label: 'Aurora',  grad: 'linear-gradient(135deg,#8b5cf6,#38bdf8)' },
  sunset:  { label: 'Sunset',  grad: 'linear-gradient(135deg,#f59e0b,#f43f5e)' },
  ocean:   { label: 'Ocean',   grad: 'linear-gradient(135deg,#06b6d4,#6366f1)' },
};

/**
 * Lets the user pick the app's accent palette. Persisted via ThemeContext.
 * Pure CSS-variable swap — recolours every accent-tinted element instantly.
 */
export function AccentSwitcher({ className = '' }: { className?: string }) {
  const { accent, setAccent } = useTheme();
  return (
    <div className={`inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-2.5 py-1.5 backdrop-blur ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pl-1 pr-0.5">Theme</span>
      {ACCENTS.map(a => (
        <button
          key={a}
          onClick={() => setAccent(a)}
          title={SWATCH[a].label}
          aria-label={`${SWATCH[a].label} theme`}
          className={`w-5 h-5 rounded-full transition-transform ${accent === a ? 'ring-2 ring-white scale-110' : 'ring-1 ring-white/20 hover:scale-105'}`}
          style={{ background: SWATCH[a].grad }}
        />
      ))}
    </div>
  );
}
