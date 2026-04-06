'use client';

import { useRef, useEffect } from 'react';
import { DiscoverFilters } from '@/lib/filter-params';
import { MOVIE_GENRES, TV_GENRES, Genre } from '@/lib/genres';

interface FilterBarProps {
  mediaType: 'movie' | 'tv';
  filters: DiscoverFilters;
  onFilterChange: (filters: DiscoverFilters) => void;
}

const YEAR_OPTIONS = [
  { value: '', label: 'Any Year' },
  { value: '2026', label: '2026' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: '2020s', label: '2020s' },
  { value: '2010s', label: '2010s' },
  { value: '2000s', label: '2000s' },
  { value: 'classic', label: 'Classic (pre-2000)' },
];

const RATING_OPTIONS = [
  { value: '', label: 'Any Rating' },
  { value: '8', label: '8+ Excellent' },
  { value: '7', label: '7+ Good' },
  { value: '6', label: '6+ Decent' },
];

const LANGUAGE_OPTIONS = [
  { value: '', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'ko', label: 'Korean' },
  { value: 'ja', label: 'Japanese' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'hi', label: 'Hindi' },
];

const SORT_OPTIONS = [
  { value: '', label: 'Popular' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'newest', label: 'Newest' },
];

export function FilterBar({ mediaType, filters, onFilterChange }: FilterBarProps) {
  const genres: Genre[] = mediaType === 'tv' ? TV_GENRES : MOVIE_GENRES;
  const chipsRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLButtonElement>(null);

  // Scroll active chip into view when genre changes
  useEffect(() => {
    if (activeChipRef.current) {
      activeChipRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [filters.genre]);

  const update = (patch: Partial<DiscoverFilters>) => {
    onFilterChange({ ...filters, ...patch });
  };

  return (
    <div className="sticky top-[64px] z-30 bg-black/95 backdrop-blur-sm border-b border-white/5 py-4 -mx-4 px-4">
      {/* Genre chips */}
      <div className="relative mb-3">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/95 to-transparent z-10 pointer-events-none" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/95 to-transparent z-10 pointer-events-none" />

        <div ref={chipsRef} className="flex gap-2 overflow-x-auto scrollbar-hide px-2">
          <button
            ref={!filters.genre ? activeChipRef : undefined}
            onClick={() => update({ genre: undefined })}
            className={`flex-none px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !filters.genre
                ? 'bg-white text-black'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {genres.map((g) => (
            <button
              key={g.id}
              ref={filters.genre === g.id ? activeChipRef : undefined}
              onClick={() => update({ genre: filters.genre === g.id ? undefined : g.id })}
              className={`flex-none px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filters.genre === g.id
                  ? 'bg-white text-black'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Dropdown filters */}
      <div className="grid grid-cols-2 md:flex md:flex-row gap-2 md:gap-3">
        <select
          value={filters.year || ''}
          onChange={(e) => update({ year: e.target.value || undefined })}
          className="bg-gray-800 text-white text-sm rounded-md px-3 py-2 border border-gray-700 focus:border-white/40 focus:outline-none appearance-none cursor-pointer"
        >
          {YEAR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.rating ? String(filters.rating) : ''}
          onChange={(e) => update({ rating: e.target.value ? Number(e.target.value) : undefined })}
          className="bg-gray-800 text-white text-sm rounded-md px-3 py-2 border border-gray-700 focus:border-white/40 focus:outline-none appearance-none cursor-pointer"
        >
          {RATING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.language || ''}
          onChange={(e) => update({ language: e.target.value || undefined })}
          className="bg-gray-800 text-white text-sm rounded-md px-3 py-2 border border-gray-700 focus:border-white/40 focus:outline-none appearance-none cursor-pointer"
        >
          {LANGUAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.sort || ''}
          onChange={(e) => update({ sort: e.target.value || undefined })}
          className="bg-gray-800 text-white text-sm rounded-md px-3 py-2 border border-gray-700 focus:border-white/40 focus:outline-none appearance-none cursor-pointer"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
