import { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { SeasonWrappedButton } from './SeasonWrappedButton';
import { MyStatsButton } from './MyStatsButton';

const PROFILE_KEY = 'scc-my-profile-id';

/**
 * Dashboard entry to Season Wrapped. If the member has told us who they are
 * (via MyStats), shows their personal Wrapped banner; otherwise nudges them
 * to pick their profile first.
 */
export function DashboardWrappedBanner() {
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    setMyId(localStorage.getItem(PROFILE_KEY));
    const onStorage = () => setMyId(localStorage.getItem(PROFILE_KEY));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (myId) return <SeasonWrappedButton memberId={myId} variant="banner" />;

  return (
    <div className="w-full relative overflow-hidden rounded-2xl px-5 py-4 flex items-center gap-3 shadow-lg"
      style={{ background: 'linear-gradient(110deg,#7c3aed,#db2777 55%,#f59e0b)' }}>
      <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-black text-base leading-tight">Your Season Wrapped is ready ✨</p>
        <p className="text-white/80 text-xs font-medium">Tell us who you are to unlock your personal season story</p>
      </div>
      <div className="flex-shrink-0">
        <MyStatsButton />
      </div>
    </div>
  );
}
