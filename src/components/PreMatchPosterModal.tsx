import { useState, useRef, useMemo } from 'react';
import { Download, Share2, Loader2, ExternalLink } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { SCC_LOGO_DATA_URL } from '../assets/sccLogo';
import type { Match, Member } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
}

const ROLE_SUFFIX: Record<string, string> = {
  wicket_keeper: ' (WK)',
};

function formatPlayerName(name: string, isCaptain: boolean, isVC: boolean, role?: string | null): string {
  let label = name.toUpperCase();
  if (role && ROLE_SUFFIX[role]) label += ROLE_SUFFIX[role];
  if (isCaptain) label += ' (C)';
  else if (isVC) label += ' (VC)';
  return label;
}

// Cricket-bat SVG (small) — used as right-side icon on every player row
const CRICKET_BAT_SVG = (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* bat */}
    <rect x="9" y="3" width="6" height="3" rx="1" transform="rotate(45 12 4.5)" fill="#3b1d6a" />
    <rect x="13" y="6" width="14" height="4" rx="1" transform="rotate(45 20 8)" fill="#3b1d6a" />
    <rect x="14" y="7" width="10" height="2.5" rx="0.5" transform="rotate(45 19 8.5)" fill="#5b2b9f" />
    {/* ball */}
    <circle cx="6" cy="24" r="3.4" fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.5" />
    <path d="M 4 22 Q 6 24 8 26" stroke="#fef2f2" strokeWidth="0.4" fill="none" />
  </svg>
);

export function PreMatchPosterModal({ isOpen, onClose, match }: Props) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const [tournamentName, setTournamentName] = useState('SCC MATCH DAY');
  const matchDate = useMemo(() => new Date(match.date), [match.date]);

  const isInternal = match.match_type === 'internal';

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

  const dateStrTop = matchDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  const dateStrInline = matchDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase();

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

      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'SCC Squad',
            text: `🏏 ${tournamentName} · ${dateStrInline}\nvs ${match.opponent || 'TBD'}`,
          });
          return;
        } catch (shareErr) {
          if ((shareErr as Error).name === 'AbortError') return;
          console.warn('Web Share failed, falling back to download:', shareErr);
        }
      }

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
          <Input label="Title (e.g. SCC MATCH DAY)" value={tournamentName} onChange={e => setTournamentName(e.target.value)} />
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
              minHeight: '1500px',
              padding: 0,
              fontFamily: '"Helvetica Neue", "Arial Black", system-ui, sans-serif',
              background: `
                radial-gradient(900px circle at 50% 0%, rgba(124,58,237,0.55), transparent 50%),
                radial-gradient(800px circle at 50% 100%, rgba(236,72,153,0.30), transparent 55%),
                linear-gradient(180deg, #2e1065 0%, #1a0b3d 50%, #0f0820 100%)
              `,
              color: '#ffffff',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* ── ART LAYER: bat, ball, batsman silhouette, floodlights ─── */}
            <svg
              width="1080" height="1500" viewBox="0 0 1080 1500"
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Wood grain gradient for the cricket-bat blade */}
                <linearGradient id="batBlade" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#d4a574" />
                  <stop offset="35%" stopColor="#f3d8a8" />
                  <stop offset="60%" stopColor="#e8c293" />
                  <stop offset="100%" stopColor="#a87740" />
                </linearGradient>
                {/* Ball seam gradient */}
                <linearGradient id="ballGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="55%" stopColor="#dc2626" />
                  <stop offset="100%" stopColor="#7f1d1d" />
                </linearGradient>
                {/* Floodlight cone */}
                <linearGradient id="floodlight" x1="50%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
                  <stop offset="50%" stopColor="#fde68a" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.35" />
                </linearGradient>
                <radialGradient id="stadiumGlow" cx="50%" cy="100%" r="65%">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.22" />
                  <stop offset="55%" stopColor="#a855f7" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>

              {/* TOP-LEFT — gold diagonal paint strokes */}
              <g transform="rotate(-25 100 100)" opacity="0.85">
                <path d="M -50 80 Q 100 60 280 70 L 280 95 Q 100 80 -50 105 Z" fill="#fbbf24" />
                <path d="M -50 130 Q 120 110 250 115 L 250 142 Q 120 130 -50 150 Z" fill="#f59e0b" />
                <path d="M -30 175 Q 80 165 180 170 L 180 188 Q 80 178 -30 195 Z" fill="#fbbf24" opacity="0.7" />
              </g>
              {/* TOP-RIGHT — purple/pink strokes */}
              <g transform="rotate(20 980 100)" opacity="0.85">
                <path d="M 830 60 Q 950 50 1130 65 L 1130 92 Q 950 75 830 85 Z" fill="#a855f7" />
                <path d="M 850 115 Q 960 105 1130 120 L 1130 145 Q 960 130 850 140 Z" fill="#ec4899" opacity="0.75" />
                <path d="M 870 165 Q 980 160 1130 170 L 1130 188 Q 980 178 870 188 Z" fill="#c084fc" opacity="0.6" />
              </g>
              {/* BOTTOM-LEFT — gold/purple strokes */}
              <g transform="rotate(-15 100 1400)" opacity="0.85">
                <path d="M -40 1320 Q 100 1310 240 1320 L 240 1345 Q 100 1335 -40 1345 Z" fill="#fbbf24" opacity="0.7" />
                <path d="M -30 1380 Q 80 1370 220 1380 L 220 1402 Q 80 1395 -30 1405 Z" fill="#a855f7" opacity="0.55" />
              </g>
              {/* BOTTOM-RIGHT — purple strokes */}
              <g transform="rotate(20 980 1400)" opacity="0.85">
                <path d="M 850 1320 Q 970 1310 1130 1325 L 1130 1348 Q 970 1335 850 1345 Z" fill="#ec4899" opacity="0.7" />
                <path d="M 870 1380 Q 970 1370 1130 1380 L 1130 1402 Q 970 1395 870 1405 Z" fill="#fbbf24" opacity="0.6" />
              </g>

              {/* ── FLOODLIGHTS at bottom ── */}
              <g opacity="0.55">
                {/* light cones rising from below */}
                <path d="M 60 1500 L 0 950 L 240 950 Z" fill="url(#floodlight)" />
                <path d="M 540 1500 L 380 920 L 700 920 Z" fill="url(#floodlight)" opacity="0.8" />
                <path d="M 1020 1500 L 840 950 L 1080 950 Z" fill="url(#floodlight)" />
              </g>
              <rect x="0" y="900" width="1080" height="600" fill="url(#stadiumGlow)" />

              {/* ── CRICKET BAT — vertical, left side ── */}
              <g transform="translate(20, 700) rotate(-12 70 0)" opacity="0.85">
                {/* Cylindrical grip at the top */}
                <rect x="60" y="-100" width="22" height="110" rx="6" fill="#0f0820" />
                {/* Grip ridges (rubber wrap diagonal lines) */}
                {[0, 12, 24, 36, 48, 60, 72, 84, 96].map(o => (
                  <line key={o} x1="56" y1={-95 + o} x2="86" y2={-95 + o + 6} stroke="#3b1d6a" strokeWidth="1.2" />
                ))}
                {/* Shoulder (transition from handle to blade) */}
                <path d="M 60 10 L 82 10 L 96 60 L 46 60 Z" fill="#0f0820" />
                {/* Blade — wood gradient */}
                <path d="M 46 60 L 96 60 L 110 720 L 32 720 Z" fill="url(#batBlade)" />
                {/* Blade highlight (single light stripe) */}
                <path d="M 60 80 L 70 80 L 76 700 L 56 700 Z" fill="#fef3c7" opacity="0.25" />
                {/* SANGRIA brand strip on the blade */}
                <rect x="42" y="380" width="62" height="50" fill="#0a0420" />
                <text x="73" y="412" textAnchor="middle" fill="#fbbf24" fontWeight="900" fontSize="13" letterSpacing="2"
                      fontFamily='"Arial Black", "Helvetica Neue", sans-serif'>
                  SANGRIA
                </text>
                {/* Bat outline */}
                <path d="M 46 60 L 96 60 L 110 720 L 32 720 Z M 60 -100 L 82 -100 L 82 10 L 60 10 Z"
                      stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" fill="none" />
              </g>

              {/* ── CRICKET BALL — bottom-left ── */}
              <g transform="translate(70, 1180)">
                <circle cx="0" cy="0" r="48" fill="url(#ballGrad)" stroke="#7f1d1d" strokeWidth="2" />
                {/* Seam — two curved strands of white stitching */}
                <path d="M -42 -16 Q 0 -8 42 -16" stroke="#fef2f2" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <path d="M -42 16 Q 0 8 42 16" stroke="#fef2f2" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                {/* Small stitches */}
                {[-32, -22, -12, -2, 8, 18, 28].map(x => (
                  <line key={x} x1={x} y1="-19" x2={x} y2="-13" stroke="#fff7ed" strokeWidth="1.4" />
                ))}
                {[-32, -22, -12, -2, 8, 18, 28].map(x => (
                  <line key={`b${x}`} x1={x} y1="13" x2={x} y2="19" stroke="#fff7ed" strokeWidth="1.4" />
                ))}
                {/* Subtle shine */}
                <ellipse cx="-12" cy="-16" rx="14" ry="6" fill="#fecaca" opacity="0.55" />
              </g>

              {/* ── BATSMAN SILHOUETTE — right side, simplified stance ── */}
              <g transform="translate(820, 660)" opacity="0.7">
                {/* Body — torso */}
                <path d="M 70 80
                         C 50 80 45 110 50 150
                         L 60 280
                         L 100 280
                         L 110 150
                         C 115 110 105 80 80 80 Z"
                      fill="#312e81" stroke="#a78bfa" strokeWidth="2" />
                {/* Head with helmet */}
                <ellipse cx="80" cy="55" rx="28" ry="32" fill="#312e81" stroke="#a78bfa" strokeWidth="2" />
                {/* Helmet visor */}
                <path d="M 55 50 Q 80 75 105 50 L 105 60 Q 80 80 55 60 Z" fill="#0f0820" />
                {/* Grille lines */}
                <line x1="58" y1="56" x2="102" y2="56" stroke="#a78bfa" strokeWidth="1" />
                <line x1="58" y1="64" x2="102" y2="64" stroke="#a78bfa" strokeWidth="1" />
                {/* Front leg (bent, anchor) */}
                <path d="M 75 280 L 60 380 L 80 400 L 100 380 L 92 280 Z" fill="#1e1b4b" stroke="#a78bfa" strokeWidth="2" />
                {/* Back leg */}
                <path d="M 92 280 L 130 360 L 145 380 L 130 395 L 110 380 L 102 280 Z" fill="#1e1b4b" stroke="#a78bfa" strokeWidth="2" />
                {/* Pads (white legguards) */}
                <rect x="58" y="290" width="22" height="100" rx="6" fill="#e5e7eb" opacity="0.85" />
                <rect x="100" y="290" width="20" height="80" rx="6" fill="#e5e7eb" opacity="0.7" />
                {/* Bat in hand */}
                <g transform="translate(140, 140) rotate(50)">
                  <rect x="0" y="0" width="14" height="60" fill="#0f0820" />
                  <rect x="-2" y="60" width="18" height="180" fill="url(#batBlade)" stroke="#1f2937" strokeWidth="1" />
                </g>
                {/* Front arm */}
                <path d="M 110 130 Q 145 130 155 145 L 145 155 Q 120 145 110 145 Z" fill="#312e81" stroke="#a78bfa" strokeWidth="1.5" />
                {/* Back arm gripping bat */}
                <path d="M 100 145 Q 130 140 145 155 L 140 165 Q 110 165 100 160 Z" fill="#312e81" stroke="#a78bfa" strokeWidth="1.5" />
              </g>

              {/* Decorative paint speckles */}
              <g opacity="0.6">
                <circle cx="180" cy="430" r="4" fill="#fbbf24" />
                <circle cx="160" cy="470" r="3" fill="#fbbf24" />
                <circle cx="220" cy="460" r="2" fill="#fbbf24" />
                <circle cx="900" cy="430" r="4" fill="#ec4899" />
                <circle cx="920" cy="470" r="2.5" fill="#a855f7" />
                <circle cx="870" cy="500" r="3" fill="#ec4899" />
              </g>
            </svg>

            {/* ── CONTENT ─────────────────────────────────────────── */}
            <div style={{ position: 'relative', padding: '60px 90px 40px 90px' }}>

              {/* LOGO — circular, gold ring */}
              <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <div style={{
                  display: 'inline-block',
                  padding: 6,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  boxShadow: '0 0 50px rgba(251,191,36,0.45)',
                }}>
                  <img
                    src={SCC_LOGO_DATA_URL}
                    alt="SCC"
                    style={{
                      width: 110, height: 110, borderRadius: '50%',
                      objectFit: 'cover', border: '4px solid #1a0b3d', display: 'block',
                    }}
                  />
                </div>
                <p style={{
                  fontSize: 18, fontWeight: 900, letterSpacing: '5px',
                  color: '#fbbf24', margin: '14px 0 0', textTransform: 'uppercase',
                  textShadow: '0 2px 12px rgba(251,191,36,0.4)',
                }}>
                  Sangria Cricket Club
                </p>
                <p style={{
                  fontSize: 13, color: '#cbd5e1', margin: '6px 0 0',
                  letterSpacing: '3px', fontWeight: 700,
                }}>
                  {dateStrTop}
                </p>
              </div>

              {/* BIG TITLE */}
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <h1 style={{
                  fontSize: 90, fontWeight: 900, margin: 0,
                  letterSpacing: '-2px', lineHeight: 0.95,
                  color: '#ffffff',
                  textShadow: '0 6px 24px rgba(0,0,0,0.5), 0 0 60px rgba(124,58,237,0.4)',
                  fontStyle: 'italic',
                  transform: 'skewX(-3deg)',
                }}>
                  {tournamentName}
                </h1>
                {/* PLAYING XII — massive gold */}
                <h2 style={{
                  fontSize: 130, fontWeight: 900, margin: '4px 0 0',
                  letterSpacing: '-3px', lineHeight: 0.9,
                  background: 'linear-gradient(180deg, #fbbf24 30%, #f59e0b 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 6px 24px rgba(251,191,36,0.35)',
                  fontStyle: 'italic',
                  transform: 'skewX(-5deg)',
                  filter: 'drop-shadow(0 4px 12px rgba(251,191,36,0.4))',
                }}>
                  {playingTitle}
                </h2>
              </div>

              {/* OPPONENT */}
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <h3 style={{
                  fontSize: 44, fontWeight: 900, margin: 0,
                  letterSpacing: '-0.5px', color: '#ffffff',
                  textTransform: 'uppercase',
                }}>
                  {isInternal
                    ? <>DHURANDARS <span style={{
                        background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                      }}>vs</span> BAZIGARS</>
                    : <>VS <span style={{
                        background: 'linear-gradient(90deg, #06b6d4, #22d3ee)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        textShadow: '0 2px 12px rgba(34,211,238,0.4)',
                      }}>{(match.opponent || 'TBD').toUpperCase()}</span></>
                  }
                </h3>

                {/* Venue + Date inline */}
                <div style={{
                  marginTop: 18, display: 'inline-flex', alignItems: 'center',
                  gap: 16, padding: '10px 22px',
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(251,191,36,0.3)',
                  borderRadius: 999,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '2px' }}>
                    📍 {match.venue.toUpperCase()}
                  </span>
                  <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.25)' }} />
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '2px' }}>
                    🗓️ {dateStrInline}
                  </span>
                </div>
              </div>

              {/* PLAYER LIST */}
              {squad.length > 0 ? (
                <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {squad.map(({ member, isCaptain, isVC }, i) => {
                    const role = member.role;
                    return (
                      <div key={member.id} style={{
                        display: 'flex',
                        alignItems: 'stretch',
                        height: 58,
                        boxShadow: isCaptain
                          ? '0 0 28px rgba(251,191,36,0.5)'
                          : '0 4px 12px rgba(0,0,0,0.4)',
                      }}>
                        {/* Number badge — gold */}
                        <div style={{
                          width: 64, flexShrink: 0,
                          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                          color: '#1a0b3d',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 30, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                          fontStyle: 'italic',
                          borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
                          boxShadow: 'inset 0 -3px 8px rgba(0,0,0,0.18)',
                        }}>
                          {i + 1}
                        </div>

                        {/* Name strip — gold gradient with skew effect */}
                        <div style={{
                          flex: 1,
                          background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)',
                          color: '#1a0b3d',
                          display: 'flex', alignItems: 'center',
                          padding: '0 22px',
                          fontSize: 22, fontWeight: 900,
                          letterSpacing: '0.5px',
                          fontStyle: 'italic',
                          textShadow: '0 1px 0 rgba(255,255,255,0.2)',
                        }}>
                          <span style={{
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                          }}>
                            {formatPlayerName(member.name, isCaptain, isVC, role)}
                          </span>
                          {member.jersey_number != null && (
                            <span style={{
                              fontSize: 14, fontWeight: 900, color: 'rgba(26,11,61,0.7)',
                              fontVariantNumeric: 'tabular-nums', marginLeft: 10,
                              padding: '2px 8px', borderRadius: 6,
                              background: 'rgba(26,11,61,0.15)',
                            }}>
                              #{member.jersey_number}
                            </span>
                          )}
                        </div>

                        {/* Icon badge — gold square with bat */}
                        <div style={{
                          width: 64, flexShrink: 0,
                          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderTopRightRadius: 12, borderBottomRightRadius: 12,
                          boxShadow: 'inset 0 -3px 8px rgba(0,0,0,0.18)',
                        }}>
                          {CRICKET_BAT_SVG}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{
                  marginTop: 32, padding: '40px 20px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  borderRadius: 16, textAlign: 'center',
                }}>
                  <p style={{ fontSize: 16, color: '#cbd5e1', margin: 0, fontWeight: 600 }}>
                    Squad not picked yet
                  </p>
                </div>
              )}

              {/* FOOTER */}
              <div style={{
                marginTop: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={SCC_LOGO_DATA_URL} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '1px' }}>
                      SANGRIA CRICKET CLUB
                    </p>
                    <p style={{ fontSize: 11, color: '#a78bfa', margin: '2px 0 0', letterSpacing: '3px', fontWeight: 700 }}>
                      PUNE · EST 2024
                    </p>
                  </div>
                </div>

                {/* Stars */}
                <div style={{ display: 'flex', gap: 8, fontSize: 22, color: '#fbbf24' }}>
                  <span>★</span><span>★</span>
                </div>

                <div style={{
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: 8,
                  color: '#1a0b3d',
                  fontSize: 12, fontWeight: 900, letterSpacing: '2.5px',
                  fontStyle: 'italic',
                  boxShadow: '0 4px 14px rgba(251,191,36,0.4)',
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
