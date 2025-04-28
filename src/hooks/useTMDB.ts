import { useQuery } from '@tanstack/react-query';
import { Movie, TVShow } from '@/types/tmdb';
import { getPopularMovies, getPopularTVShows, getMovieDetails, getTVShowDetails, searchMovies, searchTVShows } from "@/api/tmdb";

async function fetchMovies(category: string = 'popular', page: number = 1) {
  const response = await fetch(`/api/movies?category=${category}&page=${page}`);
  if (!response.ok) {
    throw new Error('Failed to fetch movies');
  }
  return response.json();
}

async function fetchTVShows(category: string = 'popular', page: number = 1) {
  const response = await fetch(`/api/tv?category=${category}&page=${page}`);
  if (!response.ok) {
    throw new Error('Failed to fetch TV shows');
  }
  return response.json();
}

export function usePopularMovies(page: number, options = {}) {
  return useQuery({
    queryKey: ["popularMovies", page],
    queryFn: () => getPopularMovies(page),
    ...options,
  });
}

export function usePopularTVShows(page: number, options = {}) {
  return useQuery({
    queryKey: ["popularTVShows", page],
    queryFn: () => getPopularTVShows(page),
    ...options,
  });
}

export function useLatestMovies(page: number = 1, options = {}) {
  return useQuery({
    queryKey: ['movies', 'latest', page],
    queryFn: () => fetchMovies('latest', page),
    ...options
  });
}

export function useLatestTVShows(page: number = 1, options = {}) {
  return useQuery({
    queryKey: ['tvshows', 'latest', page],
    queryFn: () => fetchTVShows('latest', page),
    ...options
  });
}

export function useTopRatedMovies(page: number = 1, options = {}) {
  return useQuery({
    queryKey: ['movies', 'top_rated', page],
    queryFn: () => fetchMovies('top_rated', page),
    ...options
  });
}

export function useTopRatedTVShows(page: number = 1, options = {}) {
  return useQuery({
    queryKey: ['tvshows', 'top_rated', page],
    queryFn: () => fetchTVShows('top_rated', page),
    ...options
  });
}

export function useMovieDetails(id: number, options = {}) {
  return useQuery({
    queryKey: ["movieDetails", id],
    queryFn: () => getMovieDetails(id),
    ...options,
  });
}

export function useTVShowDetails(id: number, options = {}) {
  return useQuery({
    queryKey: ["tvShowDetails", id],
    queryFn: () => getTVShowDetails(id),
    ...options,
  });
}

export function useSearchMovies(query: string, page: number, options = {}) {
  return useQuery({
    queryKey: ["searchMovies", query, page],
    queryFn: () => searchMovies(query, page),
    enabled: query.length > 0,
    ...options,
  });
}

export function useSearchTVShows(query: string, page: number, options = {}) {
  return useQuery({
    queryKey: ["searchTVShows", query, page],
    queryFn: () => searchTVShows(query, page),
    enabled: query.length > 0,
    ...options,
  });
} 