import { ExternalLink } from 'lucide-react';
import { youtubeEmbedUrl } from '../hooks/useLiveStream';

interface Props {
  videoId: string;
  title?: string;
  /** Show the "watch on YouTube" link under the player. */
  showLink?: boolean;
  className?: string;
}

/**
 * Embedded YouTube live player (16:9, responsive).
 * Phase 1 of SCC live streaming — the stream itself is produced from a phone
 * straight to YouTube Live; we simply embed it beside our own live scorecard.
 */
export function LiveStreamPlayer({ videoId, title, showLink = true, className = '' }: Props) {
  return (
    <div className={className}>
      <div className="relative w-full overflow-hidden r-card bg-black shadow-lg" style={{ aspectRatio: '16 / 9' }}>
        <iframe
          src={youtubeEmbedUrl(videoId)}
          title={title || 'SCC Live Stream'}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      {showLink && (
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 t-meta font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> Watch on YouTube (chat & full screen)
        </a>
      )}
    </div>
  );
}
