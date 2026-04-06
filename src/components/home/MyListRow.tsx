'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/Card';
import { getPosterUrl } from '@/api/tmdb';

interface MyListItem {
  tmdbId: number;
  type: 'movie' | 'tvshow';
  title: string;
  posterPath: string | null;
  addedAt: string;
}

export function MyListRow() {
  const { status } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ['mylist'],
    queryFn: async () => {
      const res = await fetch('/api/mylist');
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });

  const items: MyListItem[] = data?.items ?? [];

  if (status !== 'authenticated') return null;
  if (!isLoading && items.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My List</h2>
      </div>

      {isLoading ? (
        <div className="relative -mx-4">
          <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-none w-[180px] md:w-[200px] aspect-[2/3] rounded-md bg-gray-800 animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="relative -mx-4">
          <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8 row-container">
            {items.map((item) => (
              <div key={`${item.type}:${item.tmdbId}`} className="flex-none w-[180px] md:w-[200px]">
                <Card
                  id={item.tmdbId.toString()}
                  title={item.title}
                  type={item.type}
                  posterUrl={getPosterUrl(item.posterPath)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
