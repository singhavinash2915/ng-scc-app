import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Camera, Calendar, MapPin, Trophy } from 'lucide-react';
import type { MatchPhoto } from '../types';

interface PhotoCarouselProps {
  photos: MatchPhoto[];
  autoPlayInterval?: number;
}

export function PhotoCarousel({ photos, autoPlayInterval = 5000 }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying || photos.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % photos.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [isAutoPlaying, photos.length, autoPlayInterval]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    // Resume auto-play after 10 seconds of inactivity
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goToPrevious = () => {
    setCurrentIndex(prev => (prev - 1 + photos.length) % photos.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev + 1) % photos.length);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  if (photos.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 mb-4">
          <Camera className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
          No Team Photos Yet
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Upload photos from matches to see them here!
        </p>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];
  const match = currentPhoto.match;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black group">
      {/* Main Image */}
      <div className="relative aspect-[16/9] md:aspect-[21/9]">
        <img
          src={currentPhoto.photo_url}
          alt={currentPhoto.caption || 'Team photo'}
          className="w-full h-full object-cover transition-opacity duration-500"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Match Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          {match && (
            <div className="flex flex-wrap items-center gap-3 text-white/90 text-sm mb-2">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(match.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {match.venue}
              </span>
              {match.result && match.result !== 'upcoming' && (
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                  match.result === 'won'
                    ? 'bg-green-500/80'
                    : match.result === 'lost'
                      ? 'bg-red-500/80'
                      : 'bg-yellow-500/80'
                }`}>
                  <Trophy className="w-3 h-3" />
                  {match.result.toUpperCase()}
                </span>
              )}
            </div>
          )}
          <h3 className="text-white text-lg md:text-xl font-bold">
            {match ? `vs ${match.opponent || 'Opposition'}` : 'Team Photo'}
          </h3>
          {currentPhoto.caption && (
            <p className="text-white/80 text-sm mt-1">{currentPhoto.caption}</p>
          )}
          {match?.our_score && (
            <p className="text-white/90 font-semibold mt-1">
              {match.our_score} - {match.opponent_score}
            </p>
          )}
        </div>

        {/* Navigation Arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Photo Counter */}
        <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 text-white text-sm font-medium">
          {currentIndex + 1} / {photos.length}
        </div>
      </div>

      {/* Dot Indicators */}
      {photos.length > 1 && photos.length <= 10 && (
        <div className="absolute bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 flex gap-2">
          {photos.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to photo ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Thumbnail Strip (for more than 3 photos) */}
      {photos.length > 3 && (
        <div className="bg-black/90 p-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => goToSlide(index)}
              className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all ${
                index === currentIndex
                  ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-black'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={photo.photo_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
