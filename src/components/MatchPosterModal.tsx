import { useState, useRef, useMemo } from 'react';
import { Download, Share2, Loader2, ExternalLink } from 'lucide-react';
import { toPng } from 'html-to-image';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import type { Match } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
}

// Parse "99/8 (16.0 Ov)" → { runs: 99, wkts: 8, overs: '16.0' }
function parseScore(s: string | null | undefined) {
  if (!s) return null;
  const m = String(s).match(/(\d+)\/(\d+)\s*(?:\(([\d.]+)\s*Ov\))?/);
  if (!m) return null;
  return { runs: parseInt(m[1]), wkts: parseInt(m[2]), overs: m[3] || '' };
}

function deriveResultBanner(match: Match): string {
  if (match.result === 'upcoming') return 'UPCOMING';
  if (match.result === 'cancelled') return 'CANCELLED';
  if (match.result === 'draw') return 'MATCH DRAWN';
  if (match.notes) {
    const winBy = match.notes.match(/Win by:\s*([^|]+)/i);
    if (winBy) {
      const detail = winBy[1].trim().toUpperCase();
      return match.result === 'won' ? `WON ${detail}` : `LOST ${detail}`;
    }
  }
  // Compute from scores
  const our = parseScore(match.our_score);
  const their = parseScore(match.opponent_score);
  if (our && their) {
    if (match.result === 'won') {
      // Bat first → won by runs; chased → won by wickets
      if (our.runs > their.runs) {
        return `WON BY ${our.runs - their.runs} RUNS`;
      } else {
        return `WON BY ${10 - our.wkts} WICKETS`;
      }
    } else if (match.result === 'lost') {
      if (their.runs > our.runs) {
        return `LOST BY ${their.runs - our.runs} RUNS`;
      } else {
        return `LOST BY ${10 - their.wkts} WICKETS`;
      }
    }
  }
  return match.result.toUpperCase();
}

export function MatchPosterModal({ isOpen, onClose, match }: Props) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Editable header (defaults to "SCC Match Day")
  const [tournamentName, setTournamentName] = useState('SCC MATCH DAY');
  const [matchSubtitle, setMatchSubtitle] = useState(() => {
    const d = new Date(match.date);
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
  });

  const ourScore = parseScore(match.our_score);
  const theirScore = parseScore(match.opponent_score);
  const resultBanner = useMemo(() => deriveResultBanner(match), [match]);
  const isOurWin = match.result === 'won';
  const isInternal = match.match_type === 'internal';

  const winningTeamShort = isOurWin ? 'SCC' : (match.opponent?.split(' ')[0] || 'Opp');

  const downloadPNG = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#000000',
      });
      const link = document.createElement('a');
      link.download = `scc-${match.date}-${(match.opponent || 'match').replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('PNG export failed', e);
      alert('Could not export. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const sharePNG = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(posterRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: '#000000' });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `scc-${match.date}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'SCC Match Result' });
      } else {
        downloadPNG();
      }
    } catch {/* user cancelled / unsupported */}
    finally { setDownloading(false); }
  };

  const dateStr = new Date(match.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const cricheroesUrl = match.ch_match_id
    ? `https://cricheroes.in/scorecard/${match.ch_match_id}/x/x/scorecard`
    : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Match Poster" size="lg">
      <div className="space-y-4">

        {/* Customise header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <Input
            label="Tournament / Header"
            value={tournamentName}
            onChange={e => setTournamentName(e.target.value)}
          />
          <Input
            label="Subtitle / Match #"
            value={matchSubtitle}
            onChange={e => setMatchSubtitle(e.target.value)}
          />
        </div>

        {/* The actual poster — what gets exported */}
        <div className="overflow-x-auto rounded-2xl bg-black">
          <div
            ref={posterRef}
            style={{
              width: '1080px',
              minHeight: '1350px',
              padding: '40px 36px',
              fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              background: 'radial-gradient(800px circle at 0% 0%, rgba(16,185,129,0.25), transparent 50%), radial-gradient(700px circle at 100% 100%, rgba(245,158,11,0.18), transparent 60%), linear-gradient(135deg, #061122 0%, #0a1019 100%)',
              color: '#ffffff',
              transform: 'scale(var(--poster-scale, 1))',
              transformOrigin: 'top left',
            }}
          >
            {/* Faint cricket ground pattern */}
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.04,
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'80\' height=\'80\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'40\' cy=\'40\' r=\'30\' fill=\'none\' stroke=\'white\' stroke-width=\'1\'/%3E%3Ccircle cx=\'40\' cy=\'40\' r=\'15\' fill=\'none\' stroke=\'white\' stroke-width=\'1\'/%3E%3C/svg%3E")',
              backgroundSize: '80px 80px',
              pointerEvents: 'none',
            }} />

            {/* HEADER STRIP */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <img src="/scc-logo.jpg" alt="SCC" style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover', boxShadow: '0 8px 24px rgba(16,185,129,0.4)' }} />
              <div style={{ flex: 1, marginLeft: 24 }}>
                <h1 style={{
                  fontSize: 56, fontWeight: 900, margin: 0, letterSpacing: '-1px', lineHeight: 1.05,
                  background: 'linear-gradient(180deg, #ffffff 30%, #6ee7b7 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>{tournamentName}</h1>
                <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: '3px', color: '#34d399', margin: '4px 0 0 0', textTransform: 'uppercase' }}>
                  {matchSubtitle}
                </p>
              </div>
            </div>

            {/* SCORECARD BANNER */}
            <div style={{ marginTop: 32, position: 'relative' }}>
              <div style={{
                background: 'linear-gradient(90deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0) 100%)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 12,
                padding: '14px 24px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '4px', color: '#fbbf24', textTransform: 'uppercase' }}>
                  📋 Match Result
                </span>
                <span style={{ fontSize: 14, color: '#9ca3af' }}>
                  📍 {match.venue} · 🗓️ {dateStr}
                </span>
              </div>
            </div>

            {/* TWO TEAMS + SCORE */}
            <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 28, alignItems: 'center', position: 'relative' }}>

              {/* OUR TEAM */}
              <div style={{
                background: 'radial-gradient(400px circle at 0% 0%, rgba(16,185,129,0.35), transparent 60%), linear-gradient(135deg, #064e3b 0%, #0a1019 100%)',
                border: '2px solid rgba(16,185,129,0.4)',
                borderRadius: 24,
                padding: 28,
                textAlign: 'center',
                boxShadow: isOurWin ? '0 0 40px rgba(16,185,129,0.4)' : 'none',
                position: 'relative',
              }}>
                {isOurWin && (
                  <div style={{
                    position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                    background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                    color: '#1a0f05', fontSize: 14, fontWeight: 900, letterSpacing: '2px',
                    padding: '6px 16px', borderRadius: 999, textTransform: 'uppercase',
                  }}>🏆 Winner</div>
                )}
                <img src="/scc-logo.jpg" alt="" style={{ width: 80, height: 80, borderRadius: 18, objectFit: 'cover', margin: '0 auto', display: 'block' }} />
                <h3 style={{ fontSize: 22, fontWeight: 900, margin: '14px 0 4px', color: '#ffffff', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                  {isInternal ? 'SCC' : 'Sangria CC'}
                </h3>
                {ourScore ? (
                  <>
                    <p style={{
                      fontSize: 64, fontWeight: 900, margin: '4px 0 0 0', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                      background: isOurWin ? 'linear-gradient(180deg, #ffffff, #fde68a)' : 'linear-gradient(180deg, #ffffff, #cbd5e1)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                      {ourScore.runs}/{ourScore.wkts}
                    </p>
                    {ourScore.overs && (
                      <p style={{ fontSize: 16, color: '#9ca3af', margin: '6px 0 0', fontWeight: 600 }}>
                        ({ourScore.overs} Ov)
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: 28, color: '#9ca3af', margin: '20px 0', fontStyle: 'italic' }}>—</p>
                )}
              </div>

              {/* CENTER VS */}
              <div style={{ textAlign: 'center', alignSelf: 'center' }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '1px' }}>VS</span>
                </div>
              </div>

              {/* OPPONENT */}
              <div style={{
                background: !isOurWin && match.result === 'won'
                  ? 'radial-gradient(400px circle at 100% 0%, rgba(16,185,129,0.35), transparent 60%), linear-gradient(135deg, #1f2937 0%, #0a1019 100%)'
                  : 'linear-gradient(135deg, #1f2937 0%, #0a1019 100%)',
                border: !isOurWin && match.result === 'lost' ? '2px solid rgba(16,185,129,0.4)' : '2px solid rgba(255,255,255,0.1)',
                borderRadius: 24,
                padding: 28,
                textAlign: 'center',
                boxShadow: !isOurWin && match.result === 'lost' ? '0 0 40px rgba(16,185,129,0.4)' : 'none',
                position: 'relative',
              }}>
                {!isOurWin && match.result === 'lost' && (
                  <div style={{
                    position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                    background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                    color: '#1a0f05', fontSize: 14, fontWeight: 900, letterSpacing: '2px',
                    padding: '6px 16px', borderRadius: 999, textTransform: 'uppercase',
                  }}>🏆 Winner</div>
                )}
                <div style={{
                  width: 80, height: 80, borderRadius: 18,
                  background: 'linear-gradient(135deg, #475569, #1e293b)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                }}>
                  <span style={{ fontSize: 36, fontWeight: 900, color: '#cbd5e1' }}>
                    {(match.opponent || 'O').charAt(0)}
                  </span>
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 900, margin: '14px 0 4px', color: '#ffffff', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                  {match.opponent || 'TBD'}
                </h3>
                {theirScore ? (
                  <>
                    <p style={{
                      fontSize: 64, fontWeight: 900, margin: '4px 0 0 0', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                      background: 'linear-gradient(180deg, #ffffff, #cbd5e1)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                      {theirScore.runs}/{theirScore.wkts}
                    </p>
                    {theirScore.overs && (
                      <p style={{ fontSize: 16, color: '#9ca3af', margin: '6px 0 0', fontWeight: 600 }}>
                        ({theirScore.overs} Ov)
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize: 28, color: '#9ca3af', margin: '20px 0', fontStyle: 'italic' }}>—</p>
                )}
              </div>
            </div>

            {/* RESULT BANNER */}
            <div style={{ marginTop: 32, textAlign: 'center', position: 'relative' }}>
              <div style={{
                display: 'inline-block',
                padding: '18px 40px',
                background: match.result === 'won'
                  ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                  : match.result === 'lost'
                  ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                  : 'linear-gradient(90deg, #6b7280, #4b5563)',
                color: match.result === 'won' ? '#1a0f05' : '#ffffff',
                borderRadius: 16,
                fontSize: 28, fontWeight: 900, letterSpacing: '2px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
              }}>
                {isInternal ? 'INTERNAL MATCH' : `${winningTeamShort.toUpperCase()} ${resultBanner}`}
              </div>
            </div>

            {/* MAN OF THE MATCH */}
            {match.man_of_match && (
              <div style={{ marginTop: 36, position: 'relative' }}>
                <div style={{
                  background: 'radial-gradient(500px circle at 0% 0%, rgba(251,191,36,0.25), transparent 60%), linear-gradient(135deg, #78350f 0%, #1a0f05 60%, #0a1019 100%)',
                  border: '2px solid rgba(251,191,36,0.4)',
                  borderRadius: 24, padding: 28,
                  display: 'flex', alignItems: 'center', gap: 24,
                }}>
                  {match.man_of_match.avatar_url ? (
                    <img src={match.man_of_match.avatar_url} alt="" style={{
                      width: 120, height: 120, borderRadius: 24, objectFit: 'cover',
                      border: '4px solid rgba(251,191,36,0.6)',
                      boxShadow: '0 12px 36px rgba(251,191,36,0.5)',
                    }} />
                  ) : (
                    <div style={{
                      width: 120, height: 120, borderRadius: 24,
                      background: 'linear-gradient(135deg, #fbbf24, #b45309)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '4px solid rgba(251,191,36,0.6)',
                    }}>
                      <span style={{ fontSize: 56, fontWeight: 900, color: '#451a03' }}>
                        {match.man_of_match.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 900, letterSpacing: '4px', color: '#fbbf24', textTransform: 'uppercase', margin: 0 }}>
                      👑 Man of the Match
                    </p>
                    <h3 style={{ fontSize: 48, fontWeight: 900, color: '#ffffff', margin: '8px 0 0 0', letterSpacing: '-1px', lineHeight: 1.05 }}>
                      {match.man_of_match.name}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            {/* CAPTAIN / VICE-CAPTAIN */}
            {(match.captain || match.vice_captain) && (
              <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: match.captain && match.vice_captain ? '1fr 1fr' : '1fr', gap: 16, position: 'relative' }}>
                {match.captain && (
                  <div style={{
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #0a1019 100%)',
                    border: '1px solid rgba(59,130,246,0.4)',
                    borderRadius: 16, padding: 18,
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    {match.captain.avatar_url ? (
                      <img src={match.captain.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 14, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900 }}>
                        {match.captain.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '2px', color: '#93c5fd', textTransform: 'uppercase', margin: 0 }}>🅒 Captain</p>
                      <h4 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '2px 0 0 0' }}>{match.captain.name}</h4>
                    </div>
                  </div>
                )}
                {match.vice_captain && (
                  <div style={{
                    background: 'linear-gradient(135deg, #4c1d95 0%, #0a1019 100%)',
                    border: '1px solid rgba(168,85,247,0.4)',
                    borderRadius: 16, padding: 18,
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    {match.vice_captain.avatar_url ? (
                      <img src={match.vice_captain.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 14, background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900 }}>
                        {match.vice_captain.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '2px', color: '#d8b4fe', textTransform: 'uppercase', margin: 0 }}>🅥🅒 Vice-Captain</p>
                      <h4 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '2px 0 0 0' }}>{match.vice_captain.name}</h4>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FOOTER */}
            <div style={{
              marginTop: 40, paddingTop: 24,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img src="/scc-logo.jpg" alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }} />
                <div>
                  <p style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>Sangria Cricket Club</p>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0', letterSpacing: '1px' }}>Pune · Est. 2024</p>
                </div>
              </div>
              {cricheroesUrl && (
                <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, letterSpacing: '1px', textAlign: 'right' }}>
                  Full scorecard:<br />
                  <span style={{ color: '#34d399', fontWeight: 700 }}>cricheroes.in/scorecard/{match.ch_match_id}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button onClick={downloadPNG} loading={downloading} className="!py-3">
            {downloading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            Download PNG
          </Button>
          <Button onClick={sharePNG} loading={downloading} variant="secondary" className="!py-3">
            <Share2 className="w-4 h-4 mr-1.5" />
            Share to WhatsApp
          </Button>
        </div>

        {cricheroesUrl && (
          <a href={cricheroesUrl} target="_blank" rel="noopener noreferrer"
             className="flex items-center justify-center gap-2 text-xs text-primary-600 dark:text-primary-400 hover:underline">
            View full ball-by-ball scorecard on CricHeroes
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        <p className="text-xs text-gray-400 text-center">
          Tip: paste the downloaded PNG into a WhatsApp group or Instagram story.
        </p>
      </div>
    </Modal>
  );
}

export default MatchPosterModal;
