import { useRef, useState, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { Download, Share2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { SCC_LOGO_DATA_URL } from '../assets/sccLogo';
import type { Award } from '../hooks/useSeasonFinale';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  award: Award;
  season: string;
}

/**
 * Generates a shareable, branded "certificate" image for an Awards Night
 * winner — downloadable or shareable straight to WhatsApp via the Web Share
 * API (same html-to-image pattern used by the Player Card / Match Poster).
 */
export function AwardCertificateModal({ isOpen, onClose, award, season }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = award.member?.avatar_url;
    if (!url) { setAvatarDataUrl(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { mode: 'cors' });
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = () => { if (!cancelled) setAvatarDataUrl(reader.result as string); };
        reader.readAsDataURL(blob);
      } catch {
        if (!cancelled) setAvatarDataUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [award.member?.avatar_url]);

  if (!award.member) return null;
  const member = award.member;

  const generate = async () => {
    if (!cardRef.current) return null;
    return toPng(cardRef.current, { pixelRatio: 2.5, cacheBust: true });
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const url = await generate();
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = `scc-${award.key}-${member.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
    } catch (err) {
      console.error('Failed to generate certificate:', err);
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const url = await generate();
      if (!url) return;
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], 'scc-award.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `SCC ${award.title}`, text: `🏆 ${member.name} — ${award.title} (${season})` });
        return;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scc-award.png';
      a.click();
    } catch (err) {
      console.error('Failed to share certificate:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Award Certificate" size="md">
      <div className="flex flex-col items-center gap-4">
        <div className="overflow-hidden rounded-2xl shadow-xl" style={{ width: 300 }}>
          <div
            ref={cardRef}
            style={{
              width: 300, aspectRatio: '4 / 5', position: 'relative',
              background: 'linear-gradient(160deg, #1a0f3d 0%, #3d1a5c 45%, #5c1a3d 100%)',
              padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center',
              color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <div style={{ position: 'absolute', inset: 10, border: '2px solid rgba(251,191,36,0.4)', borderRadius: 16, pointerEvents: 'none' }} />
            <img src={SCC_LOGO_DATA_URL} alt="" style={{ width: 36, height: 36, borderRadius: 9, marginTop: 6 }} />
            <p style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7, marginTop: 10, fontWeight: 700 }}>Sangria Cricket Club · {season}</p>
            <p style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#fbbf24', marginTop: 16, fontWeight: 800 }}>Awards Night</p>
            <div style={{ fontSize: 40, marginTop: 12 }}>{award.emoji}</div>
            <p style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginTop: 6, color: '#fde68a' }}>{award.title}</p>

            <div style={{ marginTop: 18, width: 84, height: 84, borderRadius: 999, overflow: 'hidden', border: '3px solid rgba(251,191,36,0.6)', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {avatarDataUrl ? (
                <img src={avatarDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 30, fontWeight: 900 }}>{member.name.charAt(0)}</span>
              )}
            </div>
            <p style={{ fontSize: 19, fontWeight: 900, marginTop: 12, textAlign: 'center' }}>{member.name}</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', marginTop: 3 }}>{award.value}</p>
            {award.blurb && <p style={{ fontSize: 10, opacity: 0.7, marginTop: 5, textAlign: 'center', maxWidth: 220 }}>{award.blurb}</p>}

            <div style={{ marginTop: 'auto', paddingTop: 14, fontSize: 8, opacity: 0.5, letterSpacing: 1, textTransform: 'uppercase' }}>#SCCAwardsNight</div>
          </div>
        </div>
        <div className="flex gap-2 w-full">
          <Button onClick={handleDownload} disabled={busy} variant="secondary" className="flex-1">
            <Download className="w-4 h-4 mr-1.5" /> Download
          </Button>
          <Button onClick={handleShare} disabled={busy} className="flex-1">
            <Share2 className="w-4 h-4 mr-1.5" /> Share
          </Button>
        </div>
      </div>
    </Modal>
  );
}
