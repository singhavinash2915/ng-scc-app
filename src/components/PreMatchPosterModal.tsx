import { useState, useRef, useMemo } from 'react';
import { Download, Share2, Loader2, ExternalLink } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import type { Match, Member } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState(Date.now());
  useMemo(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, isPast: true };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return { days, hours, mins, isPast: false };
}

// Role → emoji for the right-side icon badge
const ROLE_ICON: Record<string, string> = {
  batsman: '🏏',
  bowler: '🎯',
  all_rounder: '⚡',
  wicket_keeper: '🧤',
};
const ROLE_SUFFIX: Record<string, string> = {
  wicket_keeper: ' (WK)',
};

// Convert "Avinash Singh" → "AVINASH SINGH"; preserve C / VC / WK markers
function formatPlayerName(name: string, isCaptain: boolean, isVC: boolean, role?: string | null): string {
  let label = name.toUpperCase();
  if (role && ROLE_SUFFIX[role]) label += ROLE_SUFFIX[role];
  if (isCaptain) label += ' (C)';
  else if (isVC) label += ' (VC)';
  return label;
}

export function PreMatchPosterModal({ isOpen, onClose, match }: Props) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const [tournamentName, setTournamentName] = useState('SCC MATCH DAY');
  const matchDate = useMemo(() => new Date(match.date), [match.date]);
  const [matchSubtitle, setMatchSubtitle] = useState(() =>
    matchDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()
  );
  const [tagline, setTagline] = useState(() => {
    const diff = matchDate.getTime() - Date.now();
    if (diff > 86400000 * 2) return 'GET READY!';
    if (diff > 86400000) return 'TOMORROW · BE THERE 🏏';
    if (diff > 0) return 'TODAY · MATCH DAY 🔥';
    return 'TODAY · LIVE NOW';
  });

  const countdown = useCountdown(match.date);
  const isInternal = match.match_type === 'internal';

  // Build the playing list. Sort with Captain first, VC second, then by role (keeper → batters → all-rounders → bowlers), else alphabetical.
  const squad = useMemo<Array<{ member: Member; isCaptain: boolean; isVC: boolean }>>(() => {
    if (!match.players) return [];
    const rawList = match.players
      .map(p => p.member)
      .filter((m): m is Member => !!m)
      .map(m => ({
        member: m,
        isCaptain: m.id === match.captain_id,
        isVC: m.id === match.vice_captain_id,
      }));

    const rolePriority: Record<string, number> = {
      wicket_keeper: 1,
      batsman: 2,
      all_rounder: 3,
      bowler: 4,
    };

    rawList.sort((a, b) => {
      if (a.isCaptain && !b.isCaptain) return -1;
      if (!a.isCaptain && b.isCaptain) return 1;
      if (a.isVC && !b.isVC) return -1;
      if (!a.isVC && b.isVC) return 1;
      const ra = a.member.role ? rolePriority[a.member.role] ?? 5 : 5;
      const rb = b.member.role ? rolePriority[b.member.role] ?? 5 : 5;
      if (ra !== rb) return ra - rb;
      return a.member.name.localeCompare(b.member.name);
    });

    return rawList;
  }, [match.players, match.captain_id, match.vice_captain_id]);

  const squadSize = squad.length;
  const playingTitle = squadSize > 0 ? `PLAYING ${squadSize === 12 ? 'XII' : squadSize === 11 ? 'XI' : `${squadSize}`}` : 'SQUAD';

  const dateStr = matchDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();

  const preWarmImages = async (root: HTMLElement) => {
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all(imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>(resolve => {
        const probe = new Image();
        probe.crossOrigin = 'anonymous';
        probe.onload = () => resolve();
        probe.onerror = () => resolve();
        probe.src = img.src;
      });
    }));
  };

  const downloadPoster = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      await preWarmImages(posterRef.current);
      const dataUrl = await toJpeg(posterRef.current, {
        cacheBust: true, pixelRatio: 1.5, quality: 0.92, backgroundColor: '#1a0b3d',
        fetchRequestInit: { mode: 'cors' as RequestMode },
      });
      const link = document.createElement('a');
      link.download = `scc-squad-${match.date}-${(match.opponent || 'match').replace(/\s+/g, '-').toLowerCase()}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
      alert('Could not export. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const sharePoster = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      await preWarmImages(posterRef.current);
      // Use a smaller pixel ratio for sharing so the file stays well under
      // the ~1MB WhatsApp limit and iOS doesn't reject it ("please select
      // different item").
      const dataUrl = await toJpeg(posterRef.current, {
        cacheBust: true, pixelRatio: 1.15, quality: 0.85, backgroundColor: '#1a0b3d',
        fetchRequestInit: { mode: 'cors' as RequestMode },
      });
      const blob = await (await fetch(dataUrl)).blob();
      if (!blob || blob.size === 0) throw new Error('Empty image blob');

      const file = new File([blob], `scc-squad-${match.date}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      // Web Share API path
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'SCC Squad',
            text: `🏏 ${tournamentName} · ${matchSubtitle}\nvs ${match.opponent || 'TBD'}`,
          });
          return;
        } catch (shareErr) {
          // User cancelled → quietly stop
          if ((shareErr as Error).name === 'AbortError') return;
          // Real failure (file too big, format rejected, etc.) → fall back
          console.warn('Web Share failed, falling back to download:', shareErr);
        }
      }

      // Fallback: trigger a download with the same data URL
      const link = document.createElement('a');
      link.download = file.name;
      link.href = dataUrl;
      link.click();
      alert("Couldn't open the share sheet — image downloaded instead. Attach it to WhatsApp manually.");
    } catch (e) {
      console.error('Share error:', e);
      alert('Could not generate the poster. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pre-Match Squad Poster" size="lg">
      <div className="space-y-4">

        {/* Customise header */}
        <div className="space-y-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Tournament / Header" value={tournamentName} onChange={e => setTournamentName(e.target.value)} />
            <Input label="Subtitle / Match #" value={matchSubtitle} onChange={e => setMatchSubtitle(e.target.value)} />
          </div>
          <Input label="Tagline (e.g. 'Tomorrow · Be there!')" value={tagline} onChange={e => setTagline(e.target.value)} />
          {squadSize === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ No squad picked yet for this match. The admin can use "Pick Squad" from the match menu.
            </p>
          )}
        </div>

        {/* The actual poster — portrait list format */}
        <div className="overflow-x-auto rounded-2xl bg-black">
          <div
            ref={posterRef}
            style={{
              width: '1080px',
              minHeight: '1350px',
              padding: '0',
              fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              background: `
                radial-gradient(900px circle at 50% 0%, rgba(124,58,237,0.55), transparent 50%),
                radial-gradient(800px circle at 50% 100%, rgba(236,72,153,0.35), transparent 55%),
                linear-gradient(180deg, #2e1065 0%, #1a0b3d 50%, #0f0820 100%)
              `,
              color: '#ffffff',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative diamond pattern — left edge */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 80,
              backgroundImage: `
                linear-gradient(45deg, rgba(236,72,153,0.5) 25%, transparent 25%, transparent 75%, rgba(236,72,153,0.5) 75%, rgba(236,72,153,0.5)),
                linear-gradient(45deg, rgba(236,72,153,0.5) 25%, transparent 25%, transparent 75%, rgba(236,72,153,0.5) 75%, rgba(236,72,153,0.5))
              `,
              backgroundSize: '40px 40px',
              backgroundPosition: '0 0, 20px 20px',
              opacity: 0.6,
              maskImage: 'linear-gradient(to right, black 0%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, black 0%, transparent 100%)',
            }} />
            {/* Decorative diamond pattern — right edge */}
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 80,
              backgroundImage: `
                linear-gradient(45deg, rgba(34,211,238,0.45) 25%, transparent 25%, transparent 75%, rgba(34,211,238,0.45) 75%, rgba(34,211,238,0.45)),
                linear-gradient(45deg, rgba(34,211,238,0.45) 25%, transparent 25%, transparent 75%, rgba(34,211,238,0.45) 75%, rgba(34,211,238,0.45))
              `,
              backgroundSize: '40px 40px',
              backgroundPosition: '0 0, 20px 20px',
              opacity: 0.6,
              maskImage: 'linear-gradient(to left, black 0%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to left, black 0%, transparent 100%)',
            }} />
            {/* Stadium silhouette suggestion at bottom */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 180,
              background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.4))',
              pointerEvents: 'none',
            }} />

            {/* CONTENT */}
            <div style={{ position: 'relative', padding: '40px 110px 50px 110px' }}>

              {/* BIG CENTRE LOGO — SCC branding hero */}
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <div style={{
                  display: 'inline-block', position: 'relative',
                  padding: 8,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  boxShadow: '0 0 40px rgba(251,191,36,0.4)',
                }}>
                  <img
                    src="/scc-logo.jpg"
                    alt="SCC"
                    style={{
                      width: 100, height: 100, borderRadius: '50%',
                      objectFit: 'cover',
                      border: '4px solid #1a0b3d',
                      display: 'block',
                    }}
                  />
                </div>
                <p style={{ fontSize: 13, fontWeight: 900, letterSpacing: '4px', color: '#fbbf24', margin: '12px 0 0', textTransform: 'uppercase' }}>
                  Sangria Cricket Club
                </p>
                <p style={{ fontSize: 11, color: '#cbd5e1', margin: '4px 0 0', letterSpacing: '2px', fontWeight: 600 }}>
                  {dateStr}
                </p>
              </div>

              {/* MAIN TITLE */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <h1 style={{
                  fontSize: 60, fontWeight: 900, margin: 0, letterSpacing: '-1px', lineHeight: 1.0,
                  color: '#ffffff',
                  textShadow: '0 4px 24px rgba(124,58,237,0.6)',
                }}>
                  {tournamentName}
                </h1>
                <h2 style={{
                  fontSize: 56, fontWeight: 900, margin: '6px 0 0', letterSpacing: '4px', lineHeight: 1.0,
                  color: '#fbbf24',
                  textShadow: '0 4px 16px rgba(251,191,36,0.4)',
                }}>
                  {playingTitle}
                </h2>
              </div>

              {/* SUBTITLE — match info */}
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: '3px', color: '#a78bfa', margin: 0, textTransform: 'uppercase' }}>
                  {tagline}
                </p>
                <h3 style={{ fontSize: 30, fontWeight: 900, color: '#ffffff', margin: '6px 0 0', letterSpacing: '-0.3px' }}>
                  {isInternal
                    ? <>Dhurandars <span style={{ color: '#fbbf24' }}>vs</span> Bazigars</>
                    : <>vs <span style={{ color: '#22d3ee' }}>{(match.opponent || 'TBD').toUpperCase()}</span></>
                  }
                </h3>
                <p style={{ fontSize: 13, color: '#cbd5e1', margin: '6px 0 0', fontWeight: 600 }}>
                  📍 {match.venue} · 🗓️ {matchSubtitle}
                </p>
                {countdown && !countdown.isPast && (countdown.days > 0 || countdown.hours > 0) && (
                  <p style={{ fontSize: 12, color: '#34d399', margin: '8px 0 0', fontWeight: 800, letterSpacing: '2px' }}>
                    ⏰ Starts in {countdown.days > 0 ? `${countdown.days}d ` : ''}{countdown.hours}h {countdown.mins}m
                  </p>
                )}
              </div>

              {/* PLAYER LIST */}
              {squad.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {squad.map(({ member, isCaptain, isVC }, i) => {
                    const role = member.role;
                    const icon = role ? ROLE_ICON[role] : '🏏';
                    const isKeeper = role === 'wicket_keeper';
                    return (
                      <div key={member.id} style={{
                        display: 'flex',
                        alignItems: 'stretch',
                        gap: 0,
                        height: 64,
                      }}>
                        {/* Number badge — gold */}
                        <div style={{
                          width: 70, flexShrink: 0,
                          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                          color: '#1a0b3d',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 30, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                          borderRadius: '12px 0 0 12px',
                          boxShadow: 'inset 0 -3px 8px rgba(0,0,0,0.15)',
                        }}>
                          {i + 1}
                        </div>

                        {/* Name strip — cyan/teal */}
                        <div style={{
                          flex: 1,
                          background: isCaptain
                            ? 'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)'
                            : isVC
                            ? 'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)'
                            : 'linear-gradient(90deg, #22d3ee 0%, #06b6d4 100%)',
                          color: '#ffffff',
                          display: 'flex', alignItems: 'center',
                          padding: '0 24px',
                          fontSize: 24, fontWeight: 900,
                          letterSpacing: '0.5px',
                          textShadow: '0 2px 4px rgba(0,0,0,0.25)',
                          borderTop: isCaptain ? '2px solid #fbbf24' : 'none',
                          borderBottom: isCaptain ? '2px solid #fbbf24' : 'none',
                        }}>
                          <span style={{
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                          }}>
                            {formatPlayerName(member.name, isCaptain, isVC, role)}
                          </span>
                          {member.jersey_number != null && (
                            <span style={{
                              fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.7)',
                              fontVariantNumeric: 'tabular-nums', marginLeft: 12,
                              padding: '2px 8px', borderRadius: 6,
                              background: 'rgba(0,0,0,0.18)',
                            }}>
                              #{member.jersey_number}
                            </span>
                          )}
                        </div>

                        {/* Icon badge — gold */}
                        <div style={{
                          width: 70, flexShrink: 0,
                          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: isKeeper ? 30 : 32,
                          borderRadius: '0 12px 12px 0',
                          boxShadow: 'inset 0 -3px 8px rgba(0,0,0,0.15)',
                        }}>
                          {icon}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{
                  padding: '40px 20px',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  borderRadius: 16, textAlign: 'center',
                }}>
                  <p style={{ fontSize: 16, color: '#cbd5e1', margin: 0, fontWeight: 600 }}>
                    Squad not picked yet
                  </p>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: '6px 0 0' }}>
                    Admin will lock in the playing XII closer to match day
                  </p>
                </div>
              )}

              {/* FOOTER */}
              <div style={{
                marginTop: 36,
                paddingTop: 18,
                borderTop: '1px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src="/scc-logo.jpg" alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '0.5px' }}>
                      SANGRIA CRICKET CLUB
                    </p>
                    <p style={{ fontSize: 10, color: '#a78bfa', margin: '2px 0 0', letterSpacing: '2px', fontWeight: 700 }}>
                      PUNE · EST 2024
                    </p>
                  </div>
                </div>
                <div style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  borderRadius: 8,
                  color: '#1a0b3d',
                  fontSize: 12, fontWeight: 900, letterSpacing: '2px',
                }}>
                  CHAMPIONS PLAY HERE 🏏
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button onClick={downloadPoster} loading={downloading} className="!py-3">
            {downloading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            Download JPG
          </Button>
          <Button onClick={sharePoster} loading={downloading} variant="secondary" className="!py-3">
            <Share2 className="w-4 h-4 mr-1.5" />
            Share to WhatsApp
          </Button>
        </div>

        {match.polling_enabled && (
          <a href={`${window.location.origin}/poll/${match.id}`} target="_blank" rel="noopener noreferrer"
             className="flex items-center justify-center gap-2 text-xs text-primary-600 dark:text-primary-400 hover:underline">
            Squad availability poll
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        <p className="text-[11px] text-gray-400 text-center">
          💡 Portrait poster ≈ 500–800 KB · WhatsApp & Instagram story friendly.
        </p>
      </div>
    </Modal>
  );
}

export default PreMatchPosterModal;
