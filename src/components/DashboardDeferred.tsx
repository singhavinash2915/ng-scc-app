import { Camera, Building2, ExternalLink } from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { PhotoCarousel } from './PhotoCarousel';
import { useMatchPhotos } from '../hooks/useMatchPhotos';
import { useSponsor } from '../hooks/useSponsor';

interface DashboardDeferredProps {
  section: 'photos' | 'sponsor';
}

export function DashboardDeferred({ section }: DashboardDeferredProps) {
  const { photos: matchPhotos } = useMatchPhotos();
  const { sponsors } = useSponsor();

  if (section === 'photos') {
    if (!matchPhotos.length) return null;
    return (
      <div>
        <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-3">
          <Camera className="w-3.5 h-3.5 text-primary-500" />
          Team Gallery
        </h2>
        <PhotoCarousel photos={matchPhotos} autoPlayInterval={5000} />
      </div>
    );
  }

  if (section === 'sponsor') {
    if (!sponsors || !sponsors.length) return null;
    return (
      <div className="space-y-3">
        {sponsors.map((s) => (
          <Card key={s.id} delay={0}>
            <CardContent className="p-4">
              <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-3">Powered By</p>
              <div className="flex items-center gap-4">
                {s.logo_url ? (
                  <img src={s.logo_url} alt={s.name} className="w-14 h-14 object-contain rounded-xl bg-gray-50 dark:bg-gray-700 p-1.5 flex-shrink-0 shadow-sm" />
                ) : (
                  <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 dark:text-white truncate">{s.name}</h3>
                  {s.tagline && <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{s.tagline}</p>}
                  {s.member && <p className="text-xs text-gray-400 mt-0.5">SCC Member: {s.member.name}</p>}
                </div>
                {s.website_url && (
                  <a href={s.website_url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0">
                    <ExternalLink className="w-4 h-4 text-gray-400 hover:text-primary-500" />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return null;
}

export default DashboardDeferred;
