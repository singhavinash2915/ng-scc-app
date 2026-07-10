import { useMemo, useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { Download, Share2, Gift } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { SCC_LOGO_DATA_URL } from '../assets/sccLogo';
import type { Member } from '../types';

interface UpcomingBday {
  member: Member;
  daysUntil: number;
  dateLabel: string;
  turning: number | null;   // age they turn, if birth year is known
  isToday: boolean;
}

// Birthday stored as YYYY-MM-DD; use UTC parts so a timezone shift can't move it.
function computeUpcoming(members: Member[], windowDays = 60): UpcomingBday[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const list: UpcomingBday[] = [];

  for (const m of members) {
    if (!m.birthday) continue;
    const b = new Date(m.birthday);
    const bMonth = b.getUTCMonth();
    const bDay = b.getUTCDate();
    const bYear = b.getUTCFullYear();

    let next = new Date(today.getFullYear(), bMonth, bDay);
    if (next < today) next = new Date(today.getFullYear() + 1, bMonth, bDay);
    const daysUntil = Math.round((next.getTime() - today.getTime()) / 86400000);
    if (daysUntil > windowDays) continue;

    const turning = bYear > 1900 ? next.getFullYear() - bYear : null;
    list.push({
      member: m,
      daysUntil,
      isToday: daysUntil === 0,
      turning,
      dateLabel: next.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    });
  }
  return list.sort((a, b) => a.daysUntil - b.daysUntil);
}

function relativeLabel(d: number) {
  if (d === 0) return 'Today! 🎉';
  if (d === 1) return 'Tomorrow';
  return `in ${d} days`;
}

export function BirthdayBoard({ members }: { members: Member[] }) {
  const upcoming = useMemo(() => computeUpcoming(members), [members]);
  const [wishFor, setWishFor] = useState<UpcomingBday | null>(null);

  if (upcoming.length === 0) return null;
  const shown = upcoming.slice(0, 6);

  return (
    <>
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🎂</span>
          <span className="text-pink-500 dark:text-pink-400 text-[10px] font-bold uppercase tracking-[2px]">Birthdays</span>
        </div>
        <div className="space-y-2">
          {shown.map(u => (
            <div key={u.member.id}
              className={`flex items-center gap-3 rounded-xl p-2 ${u.isToday ? 'bg-pink-500/10 ring-1 ring-pink-400/40' : ''}`}>
              {u.member.avatar_url ? (
                <img src={u.member.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center font-bold text-pink-600 dark:text-pink-300">
                  {u.member.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                  {u.member.name}{u.turning ? <span className="text-slate-400 dark:text-white/50 font-normal"> · turns {u.turning}</span> : null}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-white/50">{u.dateLabel} · {relativeLabel(u.daysUntil)}</p>
              </div>
              {u.daysUntil <= 3 && (
                <button onClick={() => setWishFor(u)}
                  className="flex items-center gap-1 text-[11px] font-bold text-white bg-pink-500 hover:bg-pink-600 rounded-full px-2.5 py-1.5 shrink-0">
                  <Gift className="w-3 h-3" /> Wish
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {wishFor && <WishCardModal bday={wishFor} onClose={() => setWishFor(null)} />}
    </>
  );
}

// ─── Shareable birthday wish card ──────────────────────────────────────────────
function WishCardModal({ bday, onClose }: { bday: UpcomingBday; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const { member, turning } = bday;

  useEffect(() => {
    const url = member.avatar_url;
    if (!url) { setAvatarDataUrl(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        const reader = new FileReader();
        reader.onload = () => { if (!cancelled) setAvatarDataUrl(reader.result as string); };
        reader.readAsDataURL(await res.blob());
      } catch { if (!cancelled) setAvatarDataUrl(null); }
    })();
    return () => { cancelled = true; };
  }, [member.avatar_url]);

  const generate = async () => cardRef.current ? toPng(cardRef.current, { pixelRatio: 2.5, cacheBust: true }) : null;

  const handleDownload = async () => {
    setBusy(true);
    try {
      const url = await generate(); if (!url) return;
      const a = document.createElement('a');
      a.href = url; a.download = `scc-birthday-${member.name.replace(/\s+/g, '-').toLowerCase()}.png`; a.click();
    } finally { setBusy(false); }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const url = await generate(); if (!url) return;
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], 'scc-birthday.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Happy Birthday ${member.name}!`, text: `🎂 Happy Birthday ${member.name}! — from Sangria Cricket Club` });
        return;
      }
      const a = document.createElement('a'); a.href = url; a.download = 'scc-birthday.png'; a.click();
    } finally { setBusy(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Birthday Wish" size="md">
      <div className="flex flex-col items-center gap-4">
        <div className="overflow-hidden rounded-2xl shadow-xl" style={{ width: 300 }}>
          <div ref={cardRef} style={{
            width: 300, aspectRatio: '4 / 5', position: 'relative',
            background: 'linear-gradient(160deg,#ec4899 0%,#f97316 55%,#fbbf24 100%)',
            padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center',
            color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center',
          }}>
            <div style={{ position: 'absolute', inset: 10, border: '2px solid rgba(255,255,255,0.45)', borderRadius: 16, pointerEvents: 'none' }} />
            <img src={SCC_LOGO_DATA_URL} alt="" style={{ width: 34, height: 34, borderRadius: 9, marginTop: 6 }} />
            <p style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.9, marginTop: 8, fontWeight: 700 }}>Sangria Cricket Club</p>
            <div style={{ fontSize: 40, marginTop: 14 }}>🎂🎉</div>
            <p style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginTop: 8 }}>Happy Birthday</p>
            <div style={{ marginTop: 14, width: 92, height: 92, borderRadius: 999, overflow: 'hidden', border: '3px solid rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatarDataUrl
                ? <img src={avatarDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 34, fontWeight: 900 }}>{member.name.charAt(0)}</span>}
            </div>
            <p style={{ fontSize: 21, fontWeight: 900, marginTop: 12 }}>{member.name}</p>
            {turning ? <p style={{ fontSize: 13, fontWeight: 700, opacity: 0.9, marginTop: 2 }}>Turning {turning} 🥳</p> : null}
            <p style={{ fontSize: 11, opacity: 0.9, marginTop: 'auto', paddingTop: 12 }}>Have a brilliant one, champ! 🏏</p>
            <div style={{ fontSize: 8, opacity: 0.7, letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 }}>#SangriaFamily</div>
          </div>
        </div>
        <div className="flex gap-2 w-full">
          <Button onClick={handleDownload} disabled={busy} variant="secondary" className="flex-1"><Download className="w-4 h-4 mr-1.5" /> Download</Button>
          <Button onClick={handleShare} disabled={busy} className="flex-1"><Share2 className="w-4 h-4 mr-1.5" /> Share</Button>
        </div>
      </div>
    </Modal>
  );
}
