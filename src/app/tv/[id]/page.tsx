'use client';

import { useTVShowDetails } from "@/hooks/useTMDB";
import { getTVShowEmbedUrl } from "@/api/vidsrc";
import { getPosterUrl, getBackdropUrl } from "@/api/tmdb";
import { useEffect, useState } from "react";

export default function TVShowPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: show, isLoading } = useTVShowDetails(parseInt(id));
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      const url = getTVShowEmbedUrl(show.id.toString());
      setEmbedUrl(url);
    }
  }, [show]);

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

          {embedUrl && (
            <div className="aspect-video rounded-lg overflow-hidden">
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allowFullScreen
              ></iframe>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 