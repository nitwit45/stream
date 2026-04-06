'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { getPosterUrl } from '@/api/tmdb';
import { useState } from 'react';

const TMDB_BASE = 'https://api.themoviedb.org/3';

export default function SimilarPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tmdbId = params.id as string;
  const type = (searchParams.get('type') as 'movie' | 'tvshow') || 'movie';
  const endpoint = type === 'tvshow' ? 'tv' : 'movie';
  const [page, setPage] = useState(1);

  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;

  // Fetch seed details for the title
  const { data: seedData } = useQuery({
    queryKey: ['seed-details', endpoint, tmdbId],
    queryFn: async () => {
      const res = await fetch(`${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${apiKey}`);
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
  });

  // Fetch recommendations (paginated)
  const { data: recsData, isLoading: isLoadingRecs } = useQuery({
    queryKey: ['similar-recs', endpoint, tmdbId, page],
    queryFn: async () => {
      const res = await fetch(`${TMDB_BASE}/${endpoint}/${tmdbId}/recommendations?api_key=${apiKey}&page=${page}`);
      if (!res.ok) return { results: [], total_pages: 0 };
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Fetch similar (first page, merged with recs for page 1)
  const { data: similarData, isLoading: isLoadingSimilar } = useQuery({
    queryKey: ['similar-similar', endpoint, tmdbId],
    queryFn: async () => {
      const res = await fetch(`${TMDB_BASE}/${endpoint}/${tmdbId}/similar?api_key=${apiKey}`);
      if (!res.ok) return { results: [] };
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const seedTitle = seedData?.title || seedData?.name || '';
  const recs = recsData?.results ?? [];
  const similar = similarData?.results ?? [];
  const totalPages = Math.min(recsData?.total_pages ?? 0, 20);

  // Merge and deduplicate — recs first, then similar items not already in recs
  const recsIds = new Set(recs.map((r: any) => r.id));
  const uniqueSimilar = page === 1 ? similar.filter((s: any) => !recsIds.has(s.id)) : [];
  const allItems = [...recs, ...uniqueSimilar];

  const isLoading = isLoadingRecs || (page === 1 && isLoadingSimilar);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">
        {seedTitle ? `More like ${seedTitle}` : 'Similar Titles'}
      </h1>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-md bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <p className="text-gray-400">No similar titles found.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {allItems.map((item: any) => {
              const isTV = type === 'tvshow';
              return (
                <Card
                  key={item.id}
                  id={item.id.toString()}
                  title={item.title || item.name}
                  type={isTV ? 'tvshow' : 'movie'}
                  posterUrl={getPosterUrl(item.poster_path)}
                  rating={item.vote_average}
                  releaseDate={item.release_date || item.first_air_date}
                />
              );
            })}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
