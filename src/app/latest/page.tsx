'use client';

import { useLatestMovies, useLatestTVShows } from "@/hooks/useTMDB";
import { Card } from "@/components/ui/Card";
import { getPosterUrl } from "@/api/tmdb";
import { useState } from "react";
import { Movie, TVShow } from "@/types/tmdb";

type Tab = 'movies' | 'tv';

export default function LatestPage() {
  const [tab, setTab] = useState<Tab>('movies');
  const [moviesPage, setMoviesPage] = useState(1);
  const [tvPage, setTVPage] = useState(1);

  const { data: moviesData, isLoading: isLoadingMovies } = useLatestMovies(moviesPage, {
    refetchOnWindowFocus: false,
  });
  const { data: tvData, isLoading: isLoadingTV } = useLatestTVShows(tvPage, {
    refetchOnWindowFocus: false,
  });

  const movies = moviesData?.content || [];
  const moviesTotalPages = moviesData?.totalPages || 0;
  const shows = tvData?.content || [];
  const tvTotalPages = tvData?.totalPages || 0;

  const isLoading = tab === 'movies' ? isLoadingMovies : isLoadingTV;
  const page = tab === 'movies' ? moviesPage : tvPage;
  const totalPages = tab === 'movies' ? moviesTotalPages : tvTotalPages;
  const setPage = tab === 'movies' ? setMoviesPage : setTVPage;

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Latest</h1>

      <div className="flex gap-2 mb-8 border-b border-white/10">
        <button
          onClick={() => setTab('movies')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
            tab === 'movies'
              ? 'border-primary text-white'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          Movies
        </button>
        <button
          onClick={() => setTab('tv')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 -mb-px ${
            tab === 'tv'
              ? 'border-primary text-white'
              : 'border-transparent text-white/60 hover:text-white'
          }`}
        >
          TV Shows
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 20 }).map((_, index) => (
            <div key={index} className="aspect-[2/3] rounded-lg bg-gray-800 animate-pulse"></div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {tab === 'movies'
              ? movies.map((movie: Movie) => (
                  <Card
                    key={movie.id}
                    id={movie.id.toString()}
                    title={movie.title}
                    type="movie"
                    posterUrl={getPosterUrl(movie.poster_path)}
                    rating={movie.vote_average}
                    releaseDate={movie.release_date}
                  />
                ))
              : shows.map((show: TVShow) => (
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

          <div className="flex justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-md bg-primary text-white disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-4 py-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-md bg-primary text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
