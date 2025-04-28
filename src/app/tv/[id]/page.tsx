'use client';

import { useTVShowDetails } from "@/hooks/useTMDB";
import { getEpisodeEmbedUrl } from "@/api/vidsrc";
import { getPosterUrl, getBackdropUrl } from "@/api/tmdb";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function TVShowPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: show, isLoading } = useTVShowDetails(parseInt(id));
  const [selectedSeason, setSelectedSeason] = useState(1);

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse">
          <div className="h-96 bg-gray-800 rounded-lg mb-8"></div>
          <div className="h-8 bg-gray-800 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-800 rounded w-3/4"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
            <div className="h-4 bg-gray-800 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="container py-8">
        <h1 className="text-2xl font-bold">TV Show not found</h1>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20 z-10"></div>
        <div 
          className="h-96 rounded-lg bg-cover bg-center"
          style={{
            backgroundImage: `url(${getBackdropUrl(show.backdrop_path)})`
          }}
        ></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="relative aspect-[2/3] rounded-lg overflow-hidden">
            <img
              src={getPosterUrl(show.poster_path)}
              alt={show.name}
              className="object-cover w-full h-full"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <h1 className="text-4xl font-bold mb-4">{show.name}</h1>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center">
              <span className="text-yellow-400 text-xl">★</span>
              <span className="text-xl ml-1">{show.vote_average.toFixed(1)}</span>
            </div>
            <span className="text-gray-400">|</span>
            <span>{new Date(show.first_air_date).getFullYear()}</span>
            <span className="text-gray-400">|</span>
            <span>{show.original_language.toUpperCase()}</span>
          </div>

          <p className="text-lg mb-8">{show.overview}</p>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Watch Episodes</h2>
            <div className="flex flex-wrap gap-3 mb-4">
              {Array.from({ length: show.number_of_seasons || 1 }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSeason(idx + 1)}
                  className={`px-4 py-2 rounded-md ${
                    selectedSeason === idx + 1
                      ? "bg-primary text-white"
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  Season {idx + 1}
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: selectedSeason === 1 ? (show.number_of_episodes || 10) : 10 }).map((_, idx) => (
                <Link
                  key={idx}
                  href={`/tv/${id}/season/${selectedSeason}/episode/${idx + 1}`}
                  className="px-4 py-3 bg-gray-800 rounded-md hover:bg-gray-700 text-center transition-colors"
                >
                  Episode {idx + 1}
                </Link>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Show Info</h3>
            <div className="space-y-2">
              <div className="flex">
                <span className="text-gray-400 w-32">First aired:</span>
                <span>{new Date(show.first_air_date).toLocaleDateString()}</span>
              </div>
              <div className="flex">
                <span className="text-gray-400 w-32">Seasons:</span>
                <span>{show.number_of_seasons}</span>
              </div>
              <div className="flex">
                <span className="text-gray-400 w-32">Episodes:</span>
                <span>{show.number_of_episodes}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 