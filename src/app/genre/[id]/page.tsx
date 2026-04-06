'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useDiscover } from '@/hooks/useDiscover';
import { Card } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { getPosterUrl } from '@/api/tmdb';
import { GENRE_NAME_BY_ID } from '@/lib/genres';
import { useState } from 'react';

export default function GenrePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const genreId = Number(params.id);
  const type = (searchParams.get('type') as 'movie' | 'tv') || 'movie';
  const genreName = GENRE_NAME_BY_ID[genreId] || `Genre ${genreId}`;
  const [page, setPage] = useState(1);

  const { data, isLoading } = useDiscover({
    mediaType: type,
    genre: genreId,
    page,
  });

  const items = data?.results ?? [];
  const totalPages = Math.min(data?.total_pages ?? 0, 500);

  const title = type === 'tv' ? `${genreName} TV Shows` : `${genreName} Movies`;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">{title}</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-md bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-gray-400">No {type === 'tv' ? 'TV shows' : 'movies'} found in this genre.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map((item: any) => (
              <Card
                key={item.id}
                id={item.id.toString()}
                title={item.title || item.name}
                type={type === 'tv' ? 'tvshow' : 'movie'}
                posterUrl={getPosterUrl(item.poster_path)}
                rating={item.vote_average}
                releaseDate={item.release_date || item.first_air_date}
              />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
