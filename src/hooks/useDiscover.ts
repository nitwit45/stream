import { useQuery } from '@tanstack/react-query';
import { DiscoverFilters, filtersToTMDBParams } from '@/lib/filter-params';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface DiscoverResult {
  results: any[];
  page: number;
  total_pages: number;
  total_results: number;
}

async function fetchDiscover(filters: DiscoverFilters): Promise<DiscoverResult> {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB API key is not set');

  const endpoint = filters.mediaType === 'tv' ? '/discover/tv' : '/discover/movie';
  const tmdbParams = filtersToTMDBParams(filters);

  const searchParams = new URLSearchParams({ api_key: apiKey, language: 'en-US', ...tmdbParams });
  const res = await fetch(`${TMDB_BASE_URL}${endpoint}?${searchParams}`);
  if (!res.ok) return { results: [], page: 1, total_pages: 0, total_results: 0 };
  return res.json();
}

export function useDiscover(filters: DiscoverFilters) {
  return useQuery({
    queryKey: ['discover', filters.mediaType, filters.genre, filters.year, filters.rating, filters.language, filters.sort, filters.page],
    queryFn: () => fetchDiscover(filters),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
