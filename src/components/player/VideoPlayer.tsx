'use client';

import { useEffect, useRef, useState } from 'react';

export interface PlayerSource {
  name: string;
  url: string;
}

interface VideoPlayerProps {
  sources: PlayerSource[];
  title?: string;
  storageKey?: string; // localStorage key to remember chosen source per context
  className?: string;
}

/**
 * Multi-source iframe player with user-switchable providers.
 * - Iframe load events are unreliable cross-origin, so we always expose manual switching.
 * - Remembers last-used source index in localStorage (per storageKey) so if a user
 *   found a working source they don't have to re-pick it next time.
 */
export function VideoPlayer({ sources, title, storageKey, className = '' }: VideoPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [iframeKey, setIframeKey] = useState(0); // force-remount iframe on reload
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load remembered source index
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(`player-source:${storageKey}`);
      if (saved != null) {
        const idx = parseInt(saved, 10);
        if (!Number.isNaN(idx) && idx >= 0 && idx < sources.length) {
          setCurrentIndex(idx);
        }
      }
    } catch {}
  }, [storageKey, sources.length]);

  const switchTo = (idx: number) => {
    setCurrentIndex(idx);
    setIframeKey((k) => k + 1);
    if (storageKey) {
      try {
        localStorage.setItem(`player-source:${storageKey}`, String(idx));
      } catch {}
    }
  };

  const tryNext = () => {
    const next = (currentIndex + 1) % sources.length;
    switchTo(next);
  };

  const reload = () => {
    setIframeKey((k) => k + 1);
  };

  const current = sources[currentIndex];

  return (
    <div className={className}>
      <div className="aspect-video w-full rounded-lg overflow-hidden bg-black relative">
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={current.url}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
          className="w-full h-full"
          title={title}
        />
      </div>

      {/* Source controls */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-400">Source:</span>
          {sources.map((src, idx) => (
            <button
              key={src.name}
              onClick={() => switchTo(idx)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                currentIndex === idx
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
              title={src.url}
              aria-label={`Use source ${src.name}`}
            >
              {src.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-md flex items-center gap-1.5"
            aria-label="Reload current source"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reload
          </button>
          <button
            onClick={tryNext}
            className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-md flex items-center gap-1.5"
            aria-label="Try next source"
          >
            Next Source
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Video not loading? Click a different source above. Disable adblock on this page if playback is blank.
      </p>
    </div>
  );
}

/**
 * Build the movie source list for a TMDB id.
 * Sources ordered by historical reliability. Each uses a distinct backend/CDN
 * so a block on one typically does not affect others.
 */
export function buildMovieSources(tmdbId: string | number): PlayerSource[] {
  const id = String(tmdbId);
  return [
    { name: 'VidSrc', url: `https://vsembed.ru/embed/movie?tmdb=${id}` },
    { name: 'VidSrc.to', url: `https://vidsrc.to/embed/movie/${id}` },
    { name: 'Embed.su', url: `https://embed.su/embed/movie/${id}` },
    { name: 'AutoEmbed', url: `https://autoembed.co/movie/tmdb/${id}` },
    { name: '2Embed', url: `https://www.2embed.cc/embed/${id}` },
    { name: 'MultiEmbed', url: `https://multiembed.mov/?video_id=${id}&tmdb=1` },
    { name: 'MoviesAPI', url: `https://moviesapi.club/movie/${id}` },
    { name: 'VidSrc.me', url: `https://vidsrc.me/embed/movie?tmdb=${id}` },
  ];
}

/**
 * Build the TV-episode source list for a TMDB series id + season/episode numbers.
 */
export function buildEpisodeSources(
  tmdbId: string | number,
  season: number,
  episode: number
): PlayerSource[] {
  const id = String(tmdbId);
  return [
    { name: 'VidSrc', url: `https://vsembed.ru/embed/tv/${id}/${season}-${episode}` },
    { name: 'VidSrc.to', url: `https://vidsrc.to/embed/tv/${id}/${season}/${episode}` },
    { name: 'Embed.su', url: `https://embed.su/embed/tv/${id}/${season}/${episode}` },
    { name: 'AutoEmbed', url: `https://autoembed.co/tv/tmdb/${id}-${season}-${episode}` },
    { name: '2Embed', url: `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}` },
    { name: 'MultiEmbed', url: `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}` },
    { name: 'MoviesAPI', url: `https://moviesapi.club/tv/${id}-${season}-${episode}` },
    { name: 'VidSrc.me', url: `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}` },
  ];
}
