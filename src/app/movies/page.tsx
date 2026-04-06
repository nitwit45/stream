'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { FilterBar } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { useDiscover } from '@/hooks/useDiscover';
import { getPosterUrl } from '@/api/tmdb';
import { GENRE_NAME_BY_ID } from '@/lib/genres';
import {
  DiscoverFilters,
  searchParamsToFilters,
  filtersToSearchParams,
} from '@/lib/filter-params';
import { Movie } from '@/types/tmdb';

function buildTitle(filters: DiscoverFilters): string {
  const parts: string[] = [];

  if (filters.sort === 'vote_average.desc') parts.push('Top Rated');
  if (filters.sort === 'newest') parts.push('Newest');

  if (filters.language === 'ko') parts.push('Korean');
  else if (filters.language === 'ja') parts.push('Japanese');
  else if (filters.language === 'es') parts.push('Spanish');
  else if (filters.language === 'fr') parts.push('French');
  else if (filters.language === 'hi') parts.push('Hindi');

  if (filters.genre) {
    parts.push(GENRE_NAME_BY_ID[filters.genre] || '');
  }

  parts.push('Movies');

  if (filters.year) {
    if (filters.year === 'classic') parts.push('— Classics');
    else parts.push(`— ${filters.year}`);
  }

  // Fallback: no filters = "Popular Movies"
  if (parts.length === 1 && parts[0] === 'Movies') {
    return 'Popular Movies';
  }

  return parts.filter(Boolean).join(' ');
}

export default function MoviesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<DiscoverFilters>(() =>
    searchParamsToFilters(searchParams, 'movie')
  );

  const handleFilterChange = useCallback((newFilters: DiscoverFilters) => {
    setFilters(newFilters);
    setPage(1);
    const params = filtersToSearchParams(newFilters);
    const qs = params.toString();
    router.replace(qs ? `/movies?${qs}` : '/movies');
  }, [router]);

  const { data, isLoading } = useDiscover({ ...filters, page });

  const movies = data?.results ?? [];
  const totalPages = Math.min(data?.total_pages ?? 0, 500);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">{buildTitle(filters)}</h1>

      <FilterBar mediaType="movie" filters={filters} onFilterChange={handleFilterChange} />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-6">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-md bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : movies.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No movies match your filters.</p>
          <p className="text-gray-500 text-sm mt-2">Try adjusting your criteria.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-6">
            {movies.map((movie: Movie) => (
              <Card
                key={movie.id}
                id={movie.id.toString()}
                title={movie.title}
                type="movie"
                posterUrl={getPosterUrl(movie.poster_path)}
                rating={movie.vote_average}
                releaseDate={movie.release_date}
              />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
