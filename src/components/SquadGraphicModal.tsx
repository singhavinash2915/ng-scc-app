import { useState, useRef, useEffect } from 'react';
import { Download, Loader2, Share2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { generateSquadGraphic, downloadCanvasAsPng } from '../utils/squadGraphic';
import type { Match } from '../types';

interface SquadGraphicModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
}

export function SquadGraphicModal({ isOpen, onClose, match }: SquadGraphicModalProps) {
  const [generating, setGenerating] = useState(false);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setCanvas(null);
      return;
    }

    const generate = async () => {
      setGenerating(true);
      try {
        // Load club logo
        const logo = new Image();
        logo.crossOrigin = 'anonymous';
        const logoPromise = new Promise<HTMLImageElement | null>((resolve) => {
          logo.onload = () => resolve(logo);
          logo.onerror = () => resolve(null);
          logo.src = '/scc-logo.jpg';
        });
        const loadedLogo = await logoPromise;
        const result = await generateSquadGraphic(match, loadedLogo);
        setCanvas(result);
      } catch (err) {
        console.error('Failed to generate squad graphic:', err);
      } finally {
        setGenerating(false);
      }
    };

    generate();
  }, [isOpen, match]);

  useEffect(() => {
    if (canvas && previewRef.current) {
      previewRef.current.innerHTML = '';
      const preview = canvas.cloneNode(true) as HTMLCanvasElement;
      const previewCtx = preview.getContext('2d');
      if (previewCtx) {
        preview.style.width = '100%';
        preview.style.height = 'auto';
        preview.style.borderRadius = '12px';
      }
      previewRef.current.appendChild(preview);
    }
  }, [canvas]);

  const handleDownload = () => {
    if (!canvas) return;
    const dateStr = new Date(match.date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).replace(/\s/g, '-');
    downloadCanvasAsPng(canvas, `SCC-Squad-${dateStr}.png`);
  };

  const handleShare = async () => {
    if (!canvas) return;

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!blob) return;

      const file = new File([blob], 'SCC-Squad.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'SCC Match Day Squad',
          text: `🏏 Sangria Cricket Club - Match Day Squad\n📅 ${match.date}\n📍 ${match.venue}`,
        });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Squad Graphic" size="lg">
      <div className="space-y-4">
        {generating ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Generating squad graphic...</p>
          </div>
        ) : (
          <>
            <div
              ref={previewRef}
              className="rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700"
            />

            <div className="flex gap-3">
              <Button onClick={handleDownload} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Download PNG
              </Button>
              <Button onClick={handleShare} variant="secondary" className="flex-1">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>

            <p className="text-xs text-center text-gray-400 dark:text-gray-500">
              {match.players?.length || 0} players • {match.venue} • {new Date(match.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
