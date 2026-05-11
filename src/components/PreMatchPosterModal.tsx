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

const ROLE_ICON: Record<string, string> = {
  batsman: '🏏', bowler: '⚡', all_rounder: '🌟', wicket_keeper: '🧤',
};

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

  const squad = useMemo<Member[]>(() => {
    if (!match.players) return [];
    return match.players
      .map(p => p.member)
      .filter((m): m is Member => !!m);
  }, [match.players]);

  const captain = match.captain;
  const viceCaptain = match.vice_captain;

  const dateStr = matchDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  const downloadPoster = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const imgs = Array.from(posterRef.current.querySelectorAll('img'));
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

      const dataUrl = await toJpeg(posterRef.current, {
        cacheBust: true,
        pixelRatio: 1.5,
        quality: 0.92,
        backgroundColor: '#0a1019',
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
      const imgs = Array.from(posterRef.current.querySelectorAll('img'));
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
      const dataUrl = await toJpeg(posterRef.current, {
        cacheBust: true, pixelRatio: 1.5, quality: 0.92, backgroundColor: '#0a1019',
        fetchRequestInit: { mode: 'cors' as RequestMode },
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `scc-squad-${match.date}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'SCC Squad' });
      } else {
        downloadPoster();
      }
    } catch { /* user cancelled */ }
    finally { setDownloading(false); }
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
          {squad.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ No squad picked yet for this match. The admin can use "Pick Squad" from the match menu.
            </p>
          )}
        </div>

        {/* The actual poster */}
        <div className="overflow-x-auto rounded-2xl bg-black">
          <div
            ref={posterRef}
            style={{
              width: '1280px',
              minHeight: '720px',
              padding: '24px 28px',
              fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              background: 'linear-gradient(135deg, #064e3b 0%, #0a1019 50%, #1e1b4b 100%)',
              color: '#ffffff',
              position: 'relative',
            }}
          >
            {/* HEADER */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              paddingBottom: 14,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              <img crossOrigin="anonymous" src="/scc-logo.jpg" alt="SCC" style={{ width: 52, height: 52, borderRadius: 11, objectFit: 'cover' }} />
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: '-0.5px', lineHeight: 1.05, color: '#fff' }}>
                  {tournamentName}
                </h1>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '2px', color: '#34d399', margin: '2px 0 0 0', textTransform: 'uppercase' }}>
                  {matchSubtitle}
                </p>
              </div>
              <div style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 10,
                padding: '8px 14px',
                textAlign: 'right',
              }}>
                <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '2px', color: '#fbbf24', textTransform: 'uppercase', margin: 0 }}>
                  📍 {match.venue}
                </p>
                <p style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600, margin: '3px 0 0 0' }}>
                  🗓️ {dateStr}
                </p>
              </div>
            </div>

            {/* HERO — opponent + tagline + countdown */}
            <div style={{
              marginTop: 22,
              position: 'relative',
              padding: '24px 28px',
              borderRadius: 16,
              background: 'radial-gradient(500px circle at 0% 0%, rgba(16,185,129,0.25), transparent 60%), linear-gradient(135deg, #064e3b 0%, #0a1019 100%)',
              border: '2px solid rgba(16,185,129,0.4)',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 24,
              alignItems: 'center',
            }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '4px', color: '#fbbf24', textTransform: 'uppercase', margin: 0 }}>
                  🔥 {tagline}
                </p>
                <h2 style={{
                  fontSize: 42, fontWeight: 900, margin: '8px 0 0 0',
                  letterSpacing: '-1px', lineHeight: 1.05, color: '#ffffff',
                }}>
                  {isInternal
                    ? <>Dhurandars <span style={{ color: '#fbbf24' }}>vs</span> Bazigars</>
                    : <>SCC <span style={{ color: '#fbbf24' }}>vs</span> <span style={{ color: '#34d399' }}>{match.opponent || 'TBD'}</span></>
                  }
                </h2>
                <p style={{ fontSize: 14, color: '#cbd5e1', margin: '8px 0 0', fontWeight: 600 }}>
                  📍 {match.venue}
                </p>
              </div>

              {/* Countdown badge */}
              {countdown && !countdown.isPast && (
                <div style={{ textAlign: 'center', minWidth: 160 }}>
                  <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '2px', color: '#34d399', textTransform: 'uppercase', margin: 0 }}>
                    Starts in
                  </p>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                    {[
                      { v: countdown.days, l: 'D' },
                      { v: countdown.hours, l: 'H' },
                      { v: countdown.mins, l: 'M' },
                    ].map(({ v, l }) => (
                      <div key={l} style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 8,
                        padding: '8px 10px',
                        minWidth: 44,
                      }}>
                        <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                          {String(v).padStart(2, '0')}
                        </p>
                        <p style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', margin: '4px 0 0', letterSpacing: '1px' }}>
                          {l}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SQUAD GRID */}
            {squad.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '3px', color: '#fbbf24', textTransform: 'uppercase', margin: 0 }}>
                    📋 Playing Squad ({squad.length})
                  </p>
                  {captain && (
                    <p style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, margin: 0 }}>
                      Led by <span style={{ color: '#fbbf24', fontWeight: 900 }}>{captain.name}</span>
                      {viceCaptain && <> · VC <span style={{ color: '#a78bfa', fontWeight: 900 }}>{viceCaptain.name}</span></>}
                    </p>
                  )}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(6, squad.length)}, 1fr)`,
                  gap: 10,
                }}>
                  {squad.slice(0, 12).map(m => {
                    const isCaptain = m.id === captain?.id;
                    const isVC = m.id === viceCaptain?.id;
                    return (
                      <div key={m.id} style={{
                        background: isCaptain
                          ? 'linear-gradient(135deg, #78350f 0%, #0a1019 100%)'
                          : isVC
                          ? 'linear-gradient(135deg, #4c1d95 0%, #0a1019 100%)'
                          : 'linear-gradient(135deg, #1e293b 0%, #0a1019 100%)',
                        border: isCaptain
                          ? '2px solid rgba(251,191,36,0.5)'
                          : isVC
                          ? '2px solid rgba(168,85,247,0.5)'
                          : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12,
                        padding: 10,
                        textAlign: 'center',
                        position: 'relative',
                      }}>
                        {(isCaptain || isVC) && (
                          <div style={{
                            position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)',
                            background: isCaptain ? '#fbbf24' : '#a855f7',
                            color: isCaptain ? '#1a0f05' : '#fff',
                            fontSize: 8, fontWeight: 900, letterSpacing: '1.5px',
                            padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase',
                          }}>
                            {isCaptain ? 'C' : 'VC'}
                          </div>
                        )}
                        {m.avatar_url ? (
                          <img
                            crossOrigin="anonymous"
                            src={m.avatar_url}
                            alt=""
                            style={{
                              width: 64, height: 64, borderRadius: 12, objectFit: 'cover',
                              margin: '0 auto', display: 'block',
                              border: isCaptain ? '2px solid rgba(251,191,36,0.6)' : isVC ? '2px solid rgba(168,85,247,0.6)' : '2px solid rgba(255,255,255,0.15)',
                            }}
                          />
                        ) : (
                          <div style={{
                            width: 64, height: 64, borderRadius: 12, margin: '0 auto',
                            background: 'linear-gradient(135deg, #475569, #1e293b)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: isCaptain ? '2px solid rgba(251,191,36,0.6)' : isVC ? '2px solid rgba(168,85,247,0.6)' : '2px solid rgba(255,255,255,0.15)',
                          }}>
                            <span style={{ fontSize: 28, fontWeight: 900, color: '#cbd5e1' }}>
                              {m.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <p style={{
                          fontSize: 12, fontWeight: 900, color: '#fff', margin: '8px 0 0',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          letterSpacing: '-0.2px',
                        }}>
                          {m.name.split(' ')[0]}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 2, minHeight: 14 }}>
                          {m.jersey_number != null && (
                            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              #{m.jersey_number}
                            </span>
                          )}
                          {m.role && (
                            <span style={{ fontSize: 11 }}>
                              {ROLE_ICON[m.role]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {squad.length === 0 && (
              <div style={{
                marginTop: 20, padding: '40px 20px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px dashed rgba(255,255,255,0.15)',
                borderRadius: 16, textAlign: 'center',
              }}>
                <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>
                  Squad not picked yet · Admin will lock in the playing 12 closer to match day
                </p>
              </div>
            )}

            {/* FOOTER */}
            <div style={{
              marginTop: 18, paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img crossOrigin="anonymous" src="/scc-logo.jpg" alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover' }} />
                <p style={{ fontSize: 11, fontWeight: 900, color: '#fff', margin: 0 }}>
                  Sangria Cricket Club <span style={{ color: '#9ca3af', fontWeight: 500 }}>· Pune · Est 2024</span>
                </p>
              </div>
              <p style={{ fontSize: 10, color: '#34d399', fontWeight: 900, margin: 0, letterSpacing: '1.5px' }}>
                Champions Play Here 🏏
              </p>
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
          💡 Compact landscape poster ≈ 300–500 KB · WhatsApp & Instagram friendly.
        </p>
      </div>
    </Modal>
  );
}

export default PreMatchPosterModal;
