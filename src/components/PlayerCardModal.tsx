import { useRef, useState, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import type { Member, MemberCricketStats } from '../types';
import {
  cardTheme,
  cardStats,
  positionLabel,
  computeRadar,
  overallRating,
} from '../utils/playerRating';
import { SCC_LOGO_DATA_URL } from '../assets/sccLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  member: Member;
  stats: MemberCricketStats | undefined;
  moms: number;
  matchesPlayed: number;
}

export function PlayerCardModal({ isOpen, onClose, member, stats, moms, matchesPlayed }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Pre-fetch avatar as base64 data URL so html-to-image can embed it
  // (cross-origin <img> tags are blocked by the browser's canvas taint rules)
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!member.avatar_url) { setAvatarDataUrl(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(member.avatar_url!, { mode: 'cors' });
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = () => { if (!cancelled) setAvatarDataUrl(reader.result as string); };
        reader.readAsDataURL(blob);
      } catch {
        // Couldn't fetch — fall back to null (will show initial letter instead)
        if (!cancelled) setAvatarDataUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [member.avatar_url]);

  const theme = cardTheme(member.role);
  const radar = computeRadar(stats, moms, matchesPlayed);
  const ovr = overallRating(radar, member.role);
  const pos = positionLabel(member.role);
  const statItems = cardStats(stats, moms, matchesPlayed, member.role);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const url = await toPng(cardRef.current, { pixelRatio: 2.5, cacheBust: true });
      const a = document.createElement('a');
      a.href = url;
      a.download = `scc-player-card-${member.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
    } catch (err) {
      console.error('Failed to generate card image:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Player Card" size="md">
      <div className="flex flex-col items-center gap-4">
        {/* Card canvas */}
        <div className="flex justify-center items-center p-2">
          <div
            ref={cardRef}
            style={{
              width: 280,
              height: 420,
              background: theme.bg,
              position: 'relative',
              flexShrink: 0,
              borderRadius: 20,
              overflow: 'hidden',
            }}
          >
            {/* Shimmer overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: 0.10,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%, rgba(255,255,255,0.1) 100%)',
                zIndex: 1,
              }}
            />

            {/* Top bar */}
            <div style={{ position: 'relative', zIndex: 2, padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              {/* Left: Rating + position */}
              <div>
                <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: theme.accent }}>
                  {ovr}
                </div>
                <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: theme.accent, opacity: 0.7, marginTop: 2 }}>
                  {pos}
                </div>
              </div>

              {/* Right: SCC Logo */}
              {SCC_LOGO_DATA_URL ? (
                <img
                  src={SCC_LOGO_DATA_URL}
                  alt="SCC"
                  style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: theme.accent, fontWeight: 900, fontSize: 14,
                }}>
                  SCC
                </div>
              )}
            </div>

            {/* Avatar section — uses pre-fetched data URL to avoid canvas taint */}
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              {avatarDataUrl ? (
                <img
                  src={avatarDataUrl}
                  alt={member.name}
                  style={{
                    width: 144,
                    height: 144,
                    borderRadius: 16,
                    objectFit: 'cover',
                    border: `4px solid ${theme.accent}`,
                    boxShadow: `0 8px 24px rgba(0,0,0,0.4)`,
                  }}
                />
              ) : (
                <div style={{
                  width: 144,
                  height: 144,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.1)',
                  border: `4px solid ${theme.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: theme.accent,
                  fontSize: 64,
                  fontWeight: 900,
                }}>
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name section */}
            <div style={{ position: 'relative', zIndex: 2, marginTop: 12, padding: '0 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase', color: '#ffffff', letterSpacing: 1 }}>
                {member.name}
              </div>
              <div style={{ fontSize: 11, color: theme.text, opacity: 0.7, marginTop: 2 }}>
                {member.jersey_number != null ? `#${member.jersey_number}` : ''}{member.jersey_number != null && pos ? ' · ' : ''}{pos}
              </div>
            </div>

            {/* Divider */}
            <div style={{
              margin: '12px 20px',
              height: 1,
              background: theme.accent,
              opacity: 0.2,
              position: 'relative',
              zIndex: 2,
            }} />

            {/* Stats grid */}
            <div style={{
              position: 'relative', zIndex: 2,
              padding: '0 20px 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}>
              {statItems.map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: theme.accent, opacity: 0.8, marginTop: 1 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Overall rating bar at bottom */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 4,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              background: theme.accent,
              opacity: 0.6,
              zIndex: 2,
            }} />
          </div>
        </div>

        {/* Loading notice while avatar is being fetched */}
        {member.avatar_url && !avatarDataUrl && (
          <p className="text-xs text-gray-400 text-center -mt-2">Loading photo…</p>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 w-full">
          <Button
            variant="primary"
            onClick={handleDownload}
            loading={downloading}
            disabled={!!(member.avatar_url && !avatarDataUrl)} // wait for avatar
            className="flex-1"
          >
            {downloading ? 'Generating…' : member.avatar_url && !avatarDataUrl ? 'Loading photo…' : 'Download Card'}
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
