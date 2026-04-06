'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { getPosterUrl } from '@/api/tmdb';

interface TrendingItem {
  tmdbId: number;
  type: 'movie' | 'tvshow';
  title: string;
  posterPath: string | null;
  rating?: number;
  releaseDate?: string;
  viewerCount: number;
}

export function TrendingNowRow() {
  const { data, isLoading } = useQuery({
    queryKey: ['trending-real'],
    queryFn: async () => {
      const res = await fetch('/api/trending');
      if (!res.ok) return { items: [] };
      return res.json();
    },
    staleTime: 5 * 60_000,
  });

  const items: TrendingItem[] = data?.items ?? [];

  // Don't show if no watch data yet (cold start)
  if (!isLoading && items.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Trending Now</h2>
      </div>

      {isLoading ? (
        <div className="relative -mx-4">
          <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-none w-[180px] md:w-[200px] aspect-[2/3] rounded-md bg-gray-800 animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="relative -mx-4">
          <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8 row-container">
            {items.map((item, idx) => (
              <div key={`${item.type}:${item.tmdbId}`} className="flex-none w-[180px] md:w-[200px] relative">
                {/* Rank number */}
                <div className="absolute -left-2 bottom-0 z-10 text-7xl font-black text-white/20 leading-none select-none pointer-events-none">
                  {idx + 1}
                </div>
                <Card
                  id={item.tmdbId.toString()}
                  title={item.title}
                  type={item.type}
                  posterUrl={getPosterUrl(item.posterPath)}
                  rating={item.rating}
                  releaseDate={item.releaseDate}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
