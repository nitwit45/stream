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
import { TVShow } from '@/types/tmdb';

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

  parts.push('TV Shows');

  if (filters.year) {
    if (filters.year === 'classic') parts.push('— Classics');
    else parts.push(`— ${filters.year}`);
  }

  if (parts.length === 1 && parts[0] === 'TV Shows') {
    return 'Popular TV Shows';
  }

  return parts.filter(Boolean).join(' ');
}

export default function TVPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<DiscoverFilters>(() =>
    searchParamsToFilters(searchParams, 'tv')
  );

  const handleFilterChange = useCallback((newFilters: DiscoverFilters) => {
    setFilters(newFilters);
    setPage(1);
    const params = filtersToSearchParams(newFilters);
    const qs = params.toString();
    router.replace(qs ? `/tv?${qs}` : '/tv');
  }, [router]);

  const { data, isLoading } = useDiscover({ ...filters, page });

  const shows = data?.results ?? [];
  const totalPages = Math.min(data?.total_pages ?? 0, 500);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl md:text-4xl font-bold mb-2">{buildTitle(filters)}</h1>

      <FilterBar mediaType="tv" filters={filters} onFilterChange={handleFilterChange} />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-6">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-md bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : shows.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No TV shows match your filters.</p>
          <p className="text-gray-500 text-sm mt-2">Try adjusting your criteria.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-6">
            {shows.map((show: TVShow) => (
              <Card
                key={show.id}
                id={show.id.toString()}
                title={show.name}
                type="tvshow"
                posterUrl={getPosterUrl(show.poster_path)}
                rating={show.vote_average}
                releaseDate={show.first_air_date}
              />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
