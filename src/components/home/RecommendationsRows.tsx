'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/Card';
import { getPosterUrl } from '@/api/tmdb';

interface RecRow {
  title: string;
  items: any[];
}

export function RecommendationsRows() {
  const { status } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const res = await fetch('/api/recommendations');
      if (!res.ok) return { rows: [] };
      return res.json();
    },
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000, // 5 min client-side (server caches 1 hour)
  });

  const rows: RecRow[] = data?.rows ?? [];

  if (status !== 'authenticated') return null;
  if (!isLoading && rows.length === 0) return null;

  if (isLoading) {
    return (
      <section className="mb-16">
        <div className="h-7 bg-gray-800 rounded w-64 mb-6 animate-pulse" />
        <div className="relative -mx-4">
          <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-none w-[180px] md:w-[200px] aspect-[2/3] rounded-md bg-gray-800 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {rows.map((row, idx) => (
        <section key={idx} className="mb-16">
          <h2 className="text-2xl font-bold mb-6">{row.title}</h2>
          <div className="relative -mx-4">
            <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8 row-container">
              {row.items.map((item: any) => {
                const isTV = !!item.first_air_date;
                const type = isTV ? 'tvshow' : 'movie';
                return (
                  <div key={`${type}:${item.id}`} className="flex-none w-[180px] md:w-[200px]">
                    <Card
                      id={item.id.toString()}
                      title={item.title || item.name}
                      type={type as 'movie' | 'tvshow'}
                      posterUrl={getPosterUrl(item.poster_path)}
                      rating={item.vote_average}
                      releaseDate={item.release_date || item.first_air_date}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
