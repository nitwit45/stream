'use client';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { getPosterUrl } from '@/api/tmdb';
import Link from 'next/link';

interface LatestItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  type: 'movie' | 'tvshow';
}

export function NewOnFreeFlixRow() {
  const { data, isLoading } = useQuery({
    queryKey: ['new-on-freeflix'],
    queryFn: async () => {
      const [moviesRes, tvRes] = await Promise.all([
        fetch('/api/movies?category=latest&page=1'),
        fetch('/api/tv?category=latest&page=1'),
      ]);
      const moviesData = moviesRes.ok ? await moviesRes.json() : { content: [] };
      const tvData = tvRes.ok ? await tvRes.json() : { content: [] };

      const movies: LatestItem[] = (moviesData.content || []).slice(0, 10).map((m: any) => ({
        ...m,
        type: 'movie' as const,
      }));
      const tvShows: LatestItem[] = (tvData.content || []).slice(0, 10).map((s: any) => ({
        ...s,
        type: 'tvshow' as const,
      }));

      // Interleave by release date
      const all = [...movies, ...tvShows].sort((a, b) => {
        const dateA = a.release_date || a.first_air_date || '';
        const dateB = b.release_date || b.first_air_date || '';
        return dateB.localeCompare(dateA);
      });

      return all.slice(0, 15);
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const items: LatestItem[] = data ?? [];

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">New on FreeFlix</h2>
        <Link href="/latest" className="text-sm text-white/70 hover:text-white transition-colors">
          View All
        </Link>
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
            {items.map((item) => (
              <div key={`${item.type}:${item.id}`} className="flex-none w-[180px] md:w-[200px]">
                <Card
                  id={item.id.toString()}
                  title={item.title || item.name || ''}
                  type={item.type}
                  posterUrl={getPosterUrl(item.poster_path)}
                  rating={item.vote_average}
                  releaseDate={item.release_date || item.first_air_date}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
