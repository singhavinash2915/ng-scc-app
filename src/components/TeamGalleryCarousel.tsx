import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import type { TeamGalleryPhoto } from '../hooks/useTeamGallery';

interface Props {
  photos: TeamGalleryPhoto[];
  autoPlayInterval?: number; // ms — defaults to 5000
}

/**
 * Admin-curated team photo carousel for the Dashboard.
 *
 * - Auto-rotates every `autoPlayInterval` ms (pauses on hover / interaction)
 * - Click thumbnails or dots to jump
 * - Returns null when there are no photos
 */
export function TeamGalleryCarousel({ photos, autoPlayInterval = 5000 }: Props) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (photos.length <= 1 || paused) return;
    const t = setInterval(() => setIdx(i => (i + 1) % photos.length), autoPlayInterval);
    return () => clearInterval(t);
  }, [photos.length, paused, autoPlayInterval]);

  useEffect(() => {
    if (idx >= photos.length) setIdx(0);
  }, [photos.length, idx]);

  if (!photos.length) return null;

  const goTo = (i: number) => {
    setIdx(i);
    setPaused(true);
    setTimeout(() => setPaused(false), 8000);
  };
  const prev = () => goTo((idx - 1 + photos.length) % photos.length);
  const next = () => goTo((idx + 1) % photos.length);
  const current = photos[idx];

  return (
    <div>
      <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-3">
        <Camera className="w-3.5 h-3.5 text-primary-500" />
        Team Gallery
      </h2>

      <div
        className="relative rounded-2xl overflow-hidden bg-black group"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Image stack with cross-fade */}
        <div className="relative aspect-[16/9] md:aspect-[21/9] bg-gray-900">
          {photos.map((p, i) => (
            <img
              key={p.url}
              src={p.url}
              alt={p.caption || `Team photo ${i + 1}`}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                i === idx ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}

          {/* Gradient + caption */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
          {current.caption && (
            <div className="absolute bottom-4 left-4 right-16">
              <p className="text-white text-sm md:text-base font-semibold drop-shadow-md">{current.caption}</p>
            </div>
          )}

          {/* Counter */}
          {photos.length > 1 && (
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white">
              {idx + 1} / {photos.length}
            </div>
          )}

          {/* Arrows */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100"
                aria-label="Next photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Dot indicators */}
          {photos.length > 1 && photos.length <= 8 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? 'bg-white w-5' : 'bg-white/50 hover:bg-white/80 w-1.5'
                  }`}
                  aria-label={`Go to photo ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Thumbnail strip (only when there are more than 3 photos) */}
        {photos.length > 3 && (
          <div className="bg-black/85 p-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
            {photos.map((p, i) => (
              <button
                key={p.url}
                type="button"
                onClick={() => goTo(i)}
                className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all ${
                  i === idx
                    ? 'ring-2 ring-primary-500 ring-offset-1 ring-offset-black'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <img src={p.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
