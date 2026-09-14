import { useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';
import { Download, Share2, Loader2, X } from 'lucide-react';
import { FestivalPoster } from './FestivalPoster';
import type { Festival } from '../config/festivals';

// ─── Sharing the festival poster ──────────────────────────────────────────────
// Same export path as the match posters: render the real DOM off screen, let
// html-to-image rasterise it, then hand the file to the share sheet with a
// download as the fallback. Deliberately not a second implementation — the one
// in MatchPosterModal has already learned the awkward bits (CORS-warming images,
// a smaller ratio for share so iOS doesn't reject the file).

interface Props {
  festival: Festival;
  dayLabel?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FestivalPosterModal({ festival, dayLabel, isOpen, onClose }: Props) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'share' | 'download' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!isOpen) return null;

  const render = async (forShare: boolean) => {
    if (!posterRef.current) return null;
    // Fonts must be in before the rasteriser runs, or the Devanagari line
    // exports as empty boxes on a device that had not needed it yet.
    if (document.fonts?.ready) await document.fonts.ready;
    return toJpeg(posterRef.current, {
      quality: forShare ? 0.85 : 0.94,
      pixelRatio: forShare ? 1 : 1.5,
      cacheBust: true,
      backgroundColor: festival.colors.deep,
    });
  };

  const fileName = `scc-${festival.name.toLowerCase().replace(/\s+/g, '-')}-${festival.date}.jpg`;

  const download = async () => {
    setBusy('download'); setErr(null);
    try {
      const dataUrl = await render(false);
      if (!dataUrl) return;
      const a = document.createElement('a');
      a.download = fileName;
      a.href = dataUrl;
      a.click();
    } catch (e) {
      setErr(`Could not make the image: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(null); }
  };

  const share = async () => {
    setBusy('share'); setErr(null);
    try {
      const dataUrl = await render(true);
      if (!dataUrl) return;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });

      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: festival.name,
            text: `${festival.greetingLatin} 🙏 ${festival.wish}`,
          });
          return;
        } catch (shareErr) {
          if ((shareErr as Error).name === 'AbortError') return;   // user backed out
        }
      }
      // No share sheet — hand them the file instead and say so.
      const a = document.createElement('a');
      a.download = fileName;
      a.href = dataUrl;
      a.click();
      setErr('No share sheet on this device — the image was downloaded instead.');
    } catch (e) {
      setErr(`Could not make the image: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}>
      <div className="min-h-full flex flex-col items-center justify-center p-4 gap-4"
        onClick={e => e.stopPropagation()}>

        {/* A transform does not change layout: scaled down, the poster still
            occupied its full 1350px and pushed the buttons off the screen. The
            frame is sized to the SCALED poster and clips it; the element that
            gets exported is the full-size one inside, so the file is 1080×1350
            whatever the phone is. */}
        <div style={{
          width: 'min(92vw, 420px)',
          height: 'calc(min(92vw, 420px) * 1.25)',
          overflow: 'hidden', borderRadius: 14, flexShrink: 0,
        }}>
          <div style={{
            width: 1080, height: 1350, transformOrigin: 'top left',
            transform: 'scale(calc(min(92vw, 420px) / 1080))',
          }}>
            <FestivalPoster ref={posterRef} festival={festival} dayLabel={dayLabel} />
          </div>
        </div>

        {err && (
          <p className="t-meta font-bold text-amber-300 text-center max-w-sm">{err}</p>
        )}

        <div className="flex items-center gap-2 w-full max-w-[420px]">
          <button onClick={share} disabled={busy !== null}
            className="flex-1 r-control py-3 font-black text-sm bg-amber-500 text-amber-950
                       inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Share wishes
          </button>
          <button onClick={download} disabled={busy !== null}
            className="r-control py-3 px-4 font-black text-sm bg-white/10 text-white
                       inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
          <button onClick={onClose}
            className="r-control py-3 px-4 font-black text-sm bg-white/10 text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default FestivalPosterModal;
