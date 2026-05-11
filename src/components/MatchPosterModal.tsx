import { useState, useRef, useMemo } from 'react';
import { Download, Share2, Loader2, ExternalLink } from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useMatchScorecard, type BatterRow, type BowlerRow } from '../hooks/useMatchScorecard';
import type { Match } from '../types';

// SCC's CricHeroes team ID — used to identify SCC's innings vs opponent's
const SCC_TEAM_ID = 7927431;

// Top N batters from a batting innings, sorted by runs desc.
function topBatters(batting: BatterRow[] | null | undefined, n = 3): BatterRow[] {
  if (!batting || batting.length === 0) return [];
  return [...batting]
    .filter(b => b.balls > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, n);
}

// Top N bowlers from a bowling innings, sorted by wickets desc tie-broken by runs.
function topBowlers(bowling: BowlerRow[] | null | undefined, n = 3): BowlerRow[] {
  if (!bowling || bowling.length === 0) return [];
  return [...bowling]
    .filter(b => b.wickets > 0 || (b.overs > 0 && b.runs <= 12))  // include economical spells
    .sort((a, b) => {
      if (b.wickets !== a.wickets) return b.wickets - a.wickets;
      return a.runs - b.runs;
    })
    .slice(0, n);
}

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
  const { scorecard } = useMatchScorecard(match.id);
  const [includeDetailedTables, setIncludeDetailedTables] = useState(false);  // Compact by default

  // SCC's batting & bowling — based on which innings has SCC_TEAM_ID
  const sccTop = useMemo(() => {
    if (!scorecard) return { batters: [] as BatterRow[], bowlers: [] as BowlerRow[] };
    const sccBattingInnings = scorecard.innings1_team_id === SCC_TEAM_ID
      ? scorecard.innings1_batting
      : scorecard.innings2_team_id === SCC_TEAM_ID
        ? scorecard.innings2_batting
        : null;
    // SCC bowls when SCC is NOT batting → opposite innings
    const sccBowlingInnings = scorecard.innings1_team_id === SCC_TEAM_ID
      ? scorecard.innings2_bowling
      : scorecard.innings2_team_id === SCC_TEAM_ID
        ? scorecard.innings1_bowling
        : null;
    return {
      batters: topBatters(sccBattingInnings, 3),
      bowlers: topBowlers(sccBowlingInnings, 3),
    };
  }, [scorecard]);

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

  // ── Export helpers ────────────────────────────────────────────────────
  // We use JPEG at 90% quality for the share/download buttons. JPEG is
  // 5-10× smaller than PNG for cricket posters (lots of solid color +
  // photo content) and stays under WhatsApp's 1MB share limit.
  // Pixel ratio 1.5 gives crisp results without bloating the file.
  const exportImage = async (format: 'png' | 'jpeg' = 'jpeg') => {
    if (!posterRef.current) return null;

    // Pre-warm avatar images with CORS so html-to-image can paint them.
    // Without this, Supabase Storage images sometimes render as blank
    // boxes when exported because their CORS state hadn't been established
    // before the html-to-image serializer ran.
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

    const opts = {
      cacheBust: true,
      pixelRatio: 1.5,
      backgroundColor: '#0a1019',
      fetchRequestInit: { mode: 'cors' as RequestMode },
    };
    return format === 'png'
      ? await toPng(posterRef.current, opts)
      : await toJpeg(posterRef.current, { ...opts, quality: 0.92 });
  };

  const downloadPoster = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await exportImage('jpeg');
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.download = `scc-${match.date}-${(match.opponent || 'match').replace(/\s+/g, '-').toLowerCase()}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Export failed', e);
      alert('Could not export. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const sharePoster = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await exportImage('jpeg');
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `scc-${match.date}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'SCC Match Result' });
      } else {
        downloadPoster();
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
        <div className="space-y-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          {scorecard ? (
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={includeDetailedTables}
                onChange={e => setIncludeDetailedTables(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="font-semibold">Include detailed scorecard tables</span>
              <span className="text-xs text-gray-400 ml-1">(makes poster taller — larger file)</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-auto">
                ✓ Synced from CricHeroes
              </span>
            </label>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ℹ️ No detailed scorecard yet. Run <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">python3 scripts/sync_scorecards.py</code> to fetch batter/bowler tables from CricHeroes.
            </p>
          )}
          <p className="text-[11px] text-gray-500">
            💡 Compact poster ≈ 300–500 KB · Detailed poster ≈ 1–2 MB · Both work in WhatsApp.
          </p>
        </div>

        {/* The actual poster — what gets exported */}
        <div className="overflow-x-auto rounded-2xl bg-black">
          <div
            ref={posterRef}
            style={{
              width: includeDetailedTables ? '1080px' : '1280px',
              minHeight: includeDetailedTables ? '1350px' : '720px',
              padding: includeDetailedTables ? '32px 28px' : '24px 28px',
              fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              background: 'linear-gradient(135deg, #064e3b 0%, #0a1019 60%, #0a1019 100%)',
              color: '#ffffff',
              position: 'relative',
            }}
          >
            {/* ═══════════════════════════════════════════════════════
                COMPACT LANDSCAPE LAYOUT (default — 1280×720)
                ─────────────────────────────────────────────────────── */}
            {!includeDetailedTables && (
              <>
                {/* HEADER STRIP — top 80px */}
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

                {/* MIDDLE: Two team boxes + VS center + result banner — flex row */}
                <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'center' }}>
                  {/* OUR TEAM */}
                  <div style={{
                    background: isOurWin ? '#064e3b' : '#1f2937',
                    border: isOurWin ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16, padding: 18, textAlign: 'center', position: 'relative',
                  }}>
                    {isOurWin && (
                      <div style={{
                        position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                        background: '#fbbf24', color: '#1a0f05',
                        fontSize: 10, fontWeight: 900, letterSpacing: '2px',
                        padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase',
                      }}>🏆 Winner</div>
                    )}
                    <img crossOrigin="anonymous" src="/scc-logo.jpg" alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', margin: '0 auto', display: 'block' }} />
                    <h3 style={{ fontSize: 14, fontWeight: 900, margin: '6px 0 2px', color: '#fff' }}>
                      {isInternal ? 'SCC' : 'Sangria CC'}
                    </h3>
                    {ourScore && (
                      <>
                        <p style={{
                          fontSize: 44, fontWeight: 900, margin: '4px 0 0 0', lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                          color: isOurWin ? '#fde68a' : '#fff',
                        }}>
                          {ourScore.runs}/{ourScore.wkts}
                        </p>
                        {ourScore.overs && (
                          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0', fontWeight: 600 }}>
                            ({ourScore.overs} Ov)
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* CENTER VS + RESULT BANNER */}
                  <div style={{ textAlign: 'center', minWidth: 200 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                    }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>VS</span>
                    </div>
                    <div style={{
                      marginTop: 12, padding: '10px 18px',
                      background: match.result === 'won' ? '#fbbf24'
                        : match.result === 'lost' ? '#dc2626'
                        : '#6b7280',
                      color: match.result === 'won' ? '#1a0f05' : '#fff',
                      borderRadius: 10,
                      fontSize: 16, fontWeight: 900, letterSpacing: '1px',
                      display: 'inline-block',
                    }}>
                      {isInternal ? 'INTERNAL MATCH' : `${winningTeamShort.toUpperCase()} ${resultBanner}`}
                    </div>
                  </div>

                  {/* OPPONENT */}
                  <div style={{
                    background: !isOurWin && match.result === 'lost' ? '#064e3b' : '#1f2937',
                    border: !isOurWin && match.result === 'lost' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16, padding: 18, textAlign: 'center', position: 'relative',
                  }}>
                    {!isOurWin && match.result === 'lost' && (
                      <div style={{
                        position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                        background: '#fbbf24', color: '#1a0f05',
                        fontSize: 10, fontWeight: 900, letterSpacing: '2px',
                        padding: '3px 10px', borderRadius: 999, textTransform: 'uppercase',
                      }}>🏆 Winner</div>
                    )}
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, background: '#475569',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                    }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#cbd5e1' }}>
                        {(match.opponent || 'O').charAt(0)}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 900, margin: '6px 0 2px', color: '#fff' }}>
                      {match.opponent || 'TBD'}
                    </h3>
                    {theirScore && (
                      <>
                        <p style={{
                          fontSize: 44, fontWeight: 900, margin: '4px 0 0 0', lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums', color: '#fff',
                        }}>
                          {theirScore.runs}/{theirScore.wkts}
                        </p>
                        {theirScore.overs && (
                          <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0', fontWeight: 600 }}>
                            ({theirScore.overs} Ov)
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* TOP PERFORMERS — two columns: SCC top 3 batters + bowlers */}
                {scorecard && (sccTop.batters.length > 0 || sccTop.bowlers.length > 0) && (
                  <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {/* TOP BATTERS */}
                    <div style={{
                      background: '#1e293b',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: 12,
                      padding: '12px 14px',
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '2.5px', color: '#60a5fa', textTransform: 'uppercase', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                        🏏 SCC Top Batters
                      </p>
                      {sccTop.batters.length > 0 ? sccTop.batters.map((b, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '6px 0',
                          borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : '#a16207',
                            color: i === 0 ? '#1a0f05' : i === 1 ? '#0f172a' : '#1a0f05',
                            fontSize: 11, fontWeight: 900,
                            flexShrink: 0,
                          }}>{i + 1}</span>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#fff', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {b.name}
                          </span>
                          <span style={{ fontSize: 18, fontWeight: 900, color: '#34d399', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {b.runs}
                          </span>
                          <span style={{ fontSize: 11, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            ({b.balls})
                          </span>
                        </div>
                      )) : (
                        <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0', fontStyle: 'italic', textAlign: 'center' }}>
                          No SCC batting stats yet
                        </p>
                      )}
                    </div>

                    {/* TOP BOWLERS */}
                    <div style={{
                      background: '#1e293b',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 12,
                      padding: '12px 14px',
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '2.5px', color: '#f87171', textTransform: 'uppercase', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                        ⚡ SCC Top Bowlers
                      </p>
                      {sccTop.bowlers.length > 0 ? sccTop.bowlers.map((bw, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '6px 0',
                          borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                        }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : '#a16207',
                            color: i === 0 ? '#1a0f05' : i === 1 ? '#0f172a' : '#1a0f05',
                            fontSize: 11, fontWeight: 900,
                            flexShrink: 0,
                          }}>{i + 1}</span>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#fff', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bw.name}
                          </span>
                          <span style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {bw.wickets}/{bw.runs}
                          </span>
                          <span style={{ fontSize: 11, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            ({bw.overs}{bw.balls > 0 ? `.${bw.balls}` : ''})
                          </span>
                        </div>
                      )) : (
                        <p style={{ fontSize: 12, color: '#6b7280', margin: '8px 0', fontStyle: 'italic', textAlign: 'center' }}>
                          No SCC bowling stats yet
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* MOM + Captain/VC inline strip */}
                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: match.man_of_match ? '1.4fr 1fr' : '1fr', gap: 12 }}>
                  {match.man_of_match && (
                    <div style={{
                      background: '#78350f',
                      border: '2px solid rgba(251,191,36,0.5)',
                      borderRadius: 14, padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      {match.man_of_match.avatar_url ? (
                        <img crossOrigin="anonymous" src={match.man_of_match.avatar_url} alt="" style={{
                          width: 56, height: 56, borderRadius: 12, objectFit: 'cover',
                          border: '2px solid rgba(251,191,36,0.6)',
                        }} />
                      ) : (
                        <div style={{
                          width: 56, height: 56, borderRadius: 12,
                          background: '#fbbf24',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ fontSize: 24, fontWeight: 900, color: '#451a03' }}>
                            {match.man_of_match.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '2.5px', color: '#fde68a', textTransform: 'uppercase', margin: 0 }}>
                          👑 Man of the Match
                        </p>
                        <h3 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '2px 0 0 0', letterSpacing: '-0.3px', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {match.man_of_match.name}
                        </h3>
                      </div>
                    </div>
                  )}

                  {(match.captain || match.vice_captain) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {match.captain && (
                        <div style={{
                          background: '#1e3a8a',
                          border: '1px solid rgba(59,130,246,0.4)',
                          borderRadius: 10, padding: 10,
                        }}>
                          <p style={{ fontSize: 8, fontWeight: 900, letterSpacing: '1.5px', color: '#93c5fd', textTransform: 'uppercase', margin: 0 }}>
                            🅒 Captain
                          </p>
                          <h4 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {match.captain.name}
                          </h4>
                        </div>
                      )}
                      {match.vice_captain && (
                        <div style={{
                          background: '#4c1d95',
                          border: '1px solid rgba(168,85,247,0.4)',
                          borderRadius: 10, padding: 10,
                        }}>
                          <p style={{ fontSize: 8, fontWeight: 900, letterSpacing: '1.5px', color: '#d8b4fe', textTransform: 'uppercase', margin: 0 }}>
                            🅥🅒 Vice-Captain
                          </p>
                          <h4 style={{ fontSize: 13, fontWeight: 900, color: '#fff', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {match.vice_captain.name}
                          </h4>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* FOOTER */}
                <div style={{
                  marginTop: 14, paddingTop: 12,
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img crossOrigin="anonymous" src="/scc-logo.jpg" alt="" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover' }} />
                    <p style={{ fontSize: 11, fontWeight: 900, color: '#fff', margin: 0 }}>
                      Sangria Cricket Club <span style={{ color: '#9ca3af', fontWeight: 500 }}>· Pune · Est 2024</span>
                    </p>
                  </div>
                  {cricheroesUrl && (
                    <p style={{ fontSize: 9, color: '#9ca3af', margin: 0 }}>
                      Full scorecard: <span style={{ color: '#34d399', fontWeight: 700 }}>cricheroes.in/scorecard/{match.ch_match_id}</span>
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════
                DETAILED PORTRAIT LAYOUT (when checkbox is on)
                ─────────────────────────────────────────────────────── */}
            {includeDetailedTables && (
              <>
                {/* HEADER STRIP — compact */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <img crossOrigin="anonymous" src="/scc-logo.jpg" alt="SCC" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <h1 style={{
                      fontSize: 38, fontWeight: 900, margin: 0, letterSpacing: '-0.5px', lineHeight: 1.05,
                      color: '#ffffff',
                    }}>{tournamentName}</h1>
                    <p style={{ fontSize: 14, fontWeight: 700, letterSpacing: '2.5px', color: '#34d399', margin: '4px 0 0 0', textTransform: 'uppercase' }}>
                      {matchSubtitle}
                    </p>
                  </div>
                </div>

                {/* META — date + venue */}
                <div style={{
                  marginTop: 16, padding: '10px 16px', borderRadius: 10,
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '3px', color: '#fbbf24', textTransform: 'uppercase' }}>
                    Match Result
                  </span>
                  <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 600 }}>
                    📍 {match.venue} · 🗓️ {dateStr}
                  </span>
                </div>

                {/* TWO TEAMS + SCORE */}
                <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 18, alignItems: 'center' }}>
                  <div style={{
                    background: isOurWin ? '#064e3b' : '#1f2937',
                    border: isOurWin ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 18, padding: 20, textAlign: 'center', position: 'relative',
                  }}>
                    {isOurWin && (
                      <div style={{
                        position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                        background: '#fbbf24', color: '#1a0f05',
                        fontSize: 11, fontWeight: 900, letterSpacing: '2px',
                        padding: '4px 12px', borderRadius: 999, textTransform: 'uppercase',
                      }}>🏆 Winner</div>
                    )}
                    <img crossOrigin="anonymous" src="/scc-logo.jpg" alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', margin: '0 auto', display: 'block' }} />
                    <h3 style={{ fontSize: 16, fontWeight: 900, margin: '8px 0 2px', color: '#ffffff' }}>
                      {isInternal ? 'SCC' : 'Sangria CC'}
                    </h3>
                    {ourScore && (
                      <>
                        <p style={{
                          fontSize: 52, fontWeight: 900, margin: '4px 0 0 0', lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                          color: isOurWin ? '#fde68a' : '#ffffff',
                        }}>
                          {ourScore.runs}/{ourScore.wkts}
                        </p>
                        {ourScore.overs && (
                          <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0', fontWeight: 600 }}>
                            ({ourScore.overs} Ov)
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 60, height: 60, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>VS</span>
                    </div>
                  </div>

                  <div style={{
                    background: !isOurWin && match.result === 'lost' ? '#064e3b' : '#1f2937',
                    border: !isOurWin && match.result === 'lost' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 18, padding: 20, textAlign: 'center', position: 'relative',
                  }}>
                    {!isOurWin && match.result === 'lost' && (
                      <div style={{
                        position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                        background: '#fbbf24', color: '#1a0f05',
                        fontSize: 11, fontWeight: 900, letterSpacing: '2px',
                        padding: '4px 12px', borderRadius: 999, textTransform: 'uppercase',
                      }}>🏆 Winner</div>
                    )}
                    <div style={{
                      width: 56, height: 56, borderRadius: 12, background: '#475569',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                    }}>
                      <span style={{ fontSize: 26, fontWeight: 900, color: '#cbd5e1' }}>
                        {(match.opponent || 'O').charAt(0)}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 900, margin: '8px 0 2px', color: '#ffffff' }}>
                      {match.opponent || 'TBD'}
                    </h3>
                    {theirScore && (
                      <>
                        <p style={{
                          fontSize: 52, fontWeight: 900, margin: '4px 0 0 0', lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums', color: '#ffffff',
                        }}>
                          {theirScore.runs}/{theirScore.wkts}
                        </p>
                        {theirScore.overs && (
                          <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0', fontWeight: 600 }}>
                            ({theirScore.overs} Ov)
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* RESULT BANNER */}
                <div style={{ marginTop: 22, textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-block', padding: '12px 28px',
                    background: match.result === 'won' ? '#fbbf24'
                      : match.result === 'lost' ? '#dc2626'
                      : '#6b7280',
                    color: match.result === 'won' ? '#1a0f05' : '#ffffff',
                    borderRadius: 12,
                    fontSize: 22, fontWeight: 900, letterSpacing: '1.5px',
                  }}>
                    {isInternal ? 'INTERNAL MATCH' : `${winningTeamShort.toUpperCase()} ${resultBanner}`}
                  </div>
                </div>

                {/* DETAILED SCORECARD TABLES */}
                {scorecard && (
                  <div style={{ marginTop: 32, position: 'relative' }}>
                    {[
                      { label: scorecard.innings1_team_name || 'Innings 1', batting: scorecard.innings1_batting, bowling: scorecard.innings1_bowling, extras: scorecard.innings1_extras, summary: scorecard.innings1_summary, idx: 0 },
                      { label: scorecard.innings2_team_name || 'Innings 2', batting: scorecard.innings2_batting, bowling: scorecard.innings2_bowling, extras: scorecard.innings2_extras, summary: scorecard.innings2_summary, idx: 1 },
                    ].filter(inn => inn.batting && inn.batting.length > 0).map(inn => {
                      const totalExtras = inn.summary?.total_extra ?? 0;
                      const total = inn.summary?.score ?? `${inn.summary?.total_run ?? 0}/${inn.summary?.total_wicket ?? 0}`;
                      const overs = inn.summary?.over ?? `(${inn.summary?.overs_played ?? 0} Ov)`;
                      return (
                        <div key={inn.idx} style={{ marginBottom: 24 }}>
                          <div style={{
                            background: 'linear-gradient(90deg, rgba(16,185,129,0.18), rgba(16,185,129,0.04))',
                            border: '1px solid rgba(16,185,129,0.3)',
                            padding: '12px 20px', borderRadius: '12px 12px 0 0',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}>
                            <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 1, color: '#fff', textTransform: 'uppercase' }}>{inn.label}</span>
                            <span style={{ fontSize: 14, color: '#34d399', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{total} {overs}</span>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', padding: '12px 16px' }}>
                            <table style={{ width: '100%', fontSize: 13, color: '#e5e7eb', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                              <thead>
                                <tr style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 700 }}>Batter</th>
                                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 700, width: 50 }}>R</th>
                                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 700, width: 50 }}>B</th>
                                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 700, width: 40 }}>4s</th>
                                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 700, width: 40 }}>6s</th>
                                  <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 700, width: 60 }}>SR</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(inn.batting || []).map((b, i) => (
                                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '7px 4px' }}>
                                      <div style={{ fontWeight: 700, color: '#fff' }}>{b.name}</div>
                                      {b.how_to_out && <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>{b.how_to_out}</div>}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '7px 4px', fontWeight: 900, color: '#34d399' }}>{b.runs}</td>
                                    <td style={{ textAlign: 'right', padding: '7px 4px' }}>{b.balls}</td>
                                    <td style={{ textAlign: 'right', padding: '7px 4px' }}>{b['4s']}</td>
                                    <td style={{ textAlign: 'right', padding: '7px 4px' }}>{b['6s']}</td>
                                    <td style={{ textAlign: 'right', padding: '7px 4px', color: '#9ca3af' }}>{b.SR}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {totalExtras > 0 && (
                              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8, paddingTop: 8, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                                EXTRAS: {totalExtras}
                                {inn.extras?.wide ? ` (wd ${inn.extras.wide}` : ''}
                                {inn.extras?.noball ? `${inn.extras?.wide ? ', ' : ' ('}nb ${inn.extras.noball}` : ''}
                                {(inn.extras?.wide || inn.extras?.noball) ? ')' : ''}
                              </p>
                            )}
                          </div>
                          {inn.bowling && inn.bowling.length > 0 && (
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', padding: '12px 16px', borderRadius: '0 0 12px 12px' }}>
                              <p style={{ fontSize: 11, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, margin: '0 0 8px 0' }}>Bowling</p>
                              <table style={{ width: '100%', fontSize: 13, color: '#e5e7eb', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                                <thead>
                                  <tr style={{ color: '#9ca3af', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                                    <th style={{ textAlign: 'left', padding: '4px 4px', fontWeight: 700 }}>Bowler</th>
                                    <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 700, width: 50 }}>O</th>
                                    <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 700, width: 40 }}>M</th>
                                    <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 700, width: 50 }}>R</th>
                                    <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 700, width: 40 }}>W</th>
                                    <th style={{ textAlign: 'right', padding: '4px 4px', fontWeight: 700, width: 60 }}>ECO</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(inn.bowling || []).map((bw, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                      <td style={{ padding: '6px 4px', fontWeight: 700, color: '#fff' }}>{bw.name}</td>
                                      <td style={{ textAlign: 'right', padding: '6px 4px' }}>{bw.overs}{bw.balls > 0 ? `.${bw.balls}` : ''}</td>
                                      <td style={{ textAlign: 'right', padding: '6px 4px' }}>{bw.maidens}</td>
                                      <td style={{ textAlign: 'right', padding: '6px 4px' }}>{bw.runs}</td>
                                      <td style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 900, color: '#fbbf24' }}>{bw.wickets}</td>
                                      <td style={{ textAlign: 'right', padding: '6px 4px', color: '#9ca3af' }}>{bw.economy_rate}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* MOM */}
                {match.man_of_match && (
                  <div style={{
                    marginTop: 16,
                    background: '#78350f',
                    border: '2px solid rgba(251,191,36,0.5)',
                    borderRadius: 16, padding: 16,
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    {match.man_of_match.avatar_url ? (
                      <img crossOrigin="anonymous" src={match.man_of_match.avatar_url} alt="" style={{
                        width: 80, height: 80, borderRadius: 14, objectFit: 'cover',
                        border: '3px solid rgba(251,191,36,0.6)',
                      }} />
                    ) : (
                      <div style={{ width: 80, height: 80, borderRadius: 14, background: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 32, fontWeight: 900, color: '#451a03' }}>{match.man_of_match.name.charAt(0)}</span>
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: '3px', color: '#fde68a', textTransform: 'uppercase', margin: 0 }}>👑 Man of the Match</p>
                      <h3 style={{ fontSize: 32, fontWeight: 900, color: '#ffffff', margin: '4px 0 0 0', letterSpacing: '-0.5px', lineHeight: 1.05 }}>{match.man_of_match.name}</h3>
                    </div>
                  </div>
                )}

                {/* CAPTAIN / VICE-CAPTAIN */}
                {(match.captain || match.vice_captain) && (
                  <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {match.captain && (
                      <div style={{ background: '#1e3a8a', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, flexShrink: 0 }}>🅒</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '1.5px', color: '#93c5fd', textTransform: 'uppercase', margin: 0 }}>Captain</p>
                          <h4 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: '1px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.captain.name}</h4>
                        </div>
                      </div>
                    )}
                    {match.vice_captain && (
                      <div style={{ background: '#4c1d95', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>🅥🅒</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '1.5px', color: '#d8b4fe', textTransform: 'uppercase', margin: 0 }}>Vice-Captain</p>
                          <h4 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: '1px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.vice_captain.name}</h4>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* FOOTER */}
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img crossOrigin="anonymous" src="/scc-logo.jpg" alt="" style={{ width: 32, height: 32, borderRadius: 7, objectFit: 'cover' }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 900, color: '#fff', margin: 0 }}>Sangria Cricket Club</p>
                      <p style={{ fontSize: 9, color: '#9ca3af', margin: '1px 0 0', letterSpacing: '1px' }}>PUNE · EST 2024</p>
                    </div>
                  </div>
                  {cricheroesUrl && (
                    <p style={{ fontSize: 9, color: '#9ca3af', margin: 0, textAlign: 'right' }}>
                      Full scorecard:<br />
                      <span style={{ color: '#34d399', fontWeight: 700 }}>cricheroes.in/scorecard/{match.ch_match_id}</span>
                    </p>
                  )}
                </div>
              </>
            )}
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
