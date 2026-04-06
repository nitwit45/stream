'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { getPosterUrl } from '@/api/tmdb';

type Tab = 'all' | 'movie' | 'tvshow';

interface MyListItem {
  tmdbId: number;
  type: 'movie' | 'tvshow';
  title: string;
  posterPath: string | null;
  rating?: number;
  releaseDate?: string;
  addedAt: string;
}

export default function MyListPage() {
  const { status } = useSession();
  const [tab, setTab] = useState<Tab>('all');

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

  const allItems: MyListItem[] = data?.items ?? [];
  const items = tab === 'all' ? allItems : allItems.filter((i) => i.type === tab);

  if (status === 'unauthenticated') {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">My List</h1>
        <p className="text-gray-400 text-lg mb-8">Sign in to save movies and TV shows to your list.</p>
        <Link
          href="/login"
          className="inline-flex items-center px-8 py-3 bg-red-600 text-white font-medium rounded hover:bg-red-700 transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">My List</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-md bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-6">My List</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-white/10">
        {([
          { key: 'all', label: 'All' },
          { key: 'movie', label: 'Movies' },
          { key: 'tvshow', label: 'TV Shows' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px text-sm ${
              tab === t.key
                ? 'border-red-500 text-white'
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            {t.label}
            {t.key === 'all' && allItems.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-500">({allItems.length})</span>
            )}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg mb-2">
            {allItems.length === 0
              ? 'Your list is empty.'
              : `No ${tab === 'movie' ? 'movies' : 'TV shows'} in your list.`}
          </p>
          {allItems.length === 0 && (
            <>
              <p className="text-gray-500 mb-8">Add movies and TV shows to keep track of what you want to watch.</p>
              <div className="flex justify-center gap-4">
                <Link href="/movies" className="px-6 py-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors">
                  Browse Movies
                </Link>
                <Link href="/tv" className="px-6 py-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors">
                  Browse TV Shows
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <Card
              key={`${item.type}:${item.tmdbId}`}
              id={item.tmdbId.toString()}
              title={item.title}
              type={item.type}
              posterUrl={getPosterUrl(item.posterPath)}
              rating={item.rating}
              releaseDate={item.releaseDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
