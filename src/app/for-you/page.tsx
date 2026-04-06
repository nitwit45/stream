'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { getPosterUrl } from '@/api/tmdb';
import { ContinueWatchingRow } from '@/components/home/ContinueWatchingRow';

interface RecRow {
  title: string;
  items: any[];
  rowType: string;
  seedId?: number;
  seedType?: string;
  genreId?: number;
}

interface MyListItem {
  tmdbId: number;
  type: 'movie' | 'tvshow';
  title: string;
  posterPath: string | null;
  addedAt: string;
}

export default function ForYouPage() {
  const { status } = useSession();

  const { data: recsData, isLoading: isLoadingRecs } = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () => {
      const res = await fetch('/api/recommendations');
      if (!res.ok) return { rows: [] };
      return res.json();
    },
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  });

  const { data: myListData, isLoading: isLoadingList } = useQuery({
    queryKey: ['mylist'],
    queryFn: async () => {
      const res = await fetch('/api/mylist');
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled: status === 'authenticated',
    staleTime: 30_000,
  });

  const rows: RecRow[] = recsData?.rows ?? [];
  const myListItems: MyListItem[] = myListData?.items ?? [];

  // Not authenticated — show sign-in prompt
  if (status === 'unauthenticated') {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">Personalized For You</h1>
        <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">
          Sign in to get personalized recommendations based on what you watch.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center px-8 py-3 bg-red-600 text-white font-medium rounded hover:bg-red-700 transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">For You</h1>
        {Array.from({ length: 3 }).map((_, i) => (
          <section key={i} className="mb-16">
            <div className="h-7 bg-gray-800 rounded w-64 mb-6 animate-pulse" />
            <div className="relative -mx-4">
              <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="flex-none w-[180px] md:w-[200px] aspect-[2/3] rounded-md bg-gray-800 animate-pulse" />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    );
  }

  // Cold start — no recs and no list
  const hasContent = rows.length > 0 || myListItems.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">For You</h1>

      {/* Continue Watching */}
      <ContinueWatchingRow />

      {/* My List */}
      {isLoadingList ? (
        <section className="mb-16">
          <div className="h-7 bg-gray-800 rounded w-40 mb-6 animate-pulse" />
          <div className="relative -mx-4">
            <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-none w-[180px] md:w-[200px] aspect-[2/3] rounded-md bg-gray-800 animate-pulse" />
              ))}
            </div>
          </div>
        </section>
      ) : myListItems.length > 0 ? (
        <section className="mb-16">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">My List</h2>
            <Link href="/my-list" className="text-sm text-white/70 hover:text-white transition-colors">
              View All
            </Link>
          </div>
          <div className="relative -mx-4">
            <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8 row-container">
              {myListItems.map((item) => (
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
        </section>
      ) : null}

      {/* Recommendation rows */}
      {isLoadingRecs ? (
        Array.from({ length: 3 }).map((_, i) => (
          <section key={i} className="mb-16">
            <div className="h-7 bg-gray-800 rounded w-64 mb-6 animate-pulse" />
            <div className="relative -mx-4">
              <div className="flex overflow-x-auto scrollbar-hide gap-4 px-4 pb-8">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="flex-none w-[180px] md:w-[200px] aspect-[2/3] rounded-md bg-gray-800 animate-pulse" />
                ))}
              </div>
            </div>
          </section>
        ))
      ) : (
        rows.map((row, idx) => {
          // Build View All link based on row type
          let viewAllHref: string | null = null;
          if (row.rowType === 'similar' && row.seedId) {
            viewAllHref = `/for-you/similar/${row.seedId}?type=${row.seedType || 'movie'}`;
          } else if (row.rowType === 'genre' && row.genreId) {
            viewAllHref = `/genre/${row.genreId}`;
          }

          return (
            <section key={idx} className="mb-16">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{row.title}</h2>
                {viewAllHref && (
                  <Link href={viewAllHref} className="text-sm text-white/70 hover:text-white transition-colors">
                    View All
                  </Link>
                )}
              </div>
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
          );
        })
      )}

      {/* Cold start message */}
      {!isLoadingRecs && !isLoadingList && !hasContent && (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg mb-2">Start watching to get personalized recommendations!</p>
          <p className="text-gray-500 mb-8">The more you watch, the better we get at suggesting what you'll love.</p>
          <div className="flex justify-center gap-4">
            <Link href="/movies" className="px-6 py-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors">
              Browse Movies
            </Link>
            <Link href="/tv" className="px-6 py-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors">
              Browse TV Shows
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
