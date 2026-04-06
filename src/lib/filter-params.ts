export interface DiscoverFilters {
  mediaType: 'movie' | 'tv';
  genre?: number;
  year?: string;
  rating?: number;
  language?: string;
  sort?: string;
  page?: number;
}

const DEFAULTS = {
  sort: 'popularity.desc',
};

/** Convert filter state → URL search params (omitting defaults for clean URLs) */
export function filtersToSearchParams(filters: DiscoverFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.genre) params.set('genre', String(filters.genre));
  if (filters.year) params.set('year', filters.year);
  if (filters.rating) params.set('rating', String(filters.rating));
  if (filters.language) params.set('lang', filters.language);
  if (filters.sort && filters.sort !== DEFAULTS.sort) params.set('sort', filters.sort);
  return params;
}

/** Parse URL search params → filter state */
export function searchParamsToFilters(
  params: URLSearchParams,
  mediaType: 'movie' | 'tv'
): DiscoverFilters {
  const genre = params.get('genre');
  const year = params.get('year');
  const rating = params.get('rating');
  const lang = params.get('lang');
  const sort = params.get('sort');

  return {
    mediaType,
    genre: genre ? Number(genre) : undefined,
    year: year || undefined,
    rating: rating ? Number(rating) : undefined,
    language: lang || undefined,
    sort: sort || undefined,
  };
}

/** Build the TMDB discover URL params from filter state */
export function filtersToTMDBParams(filters: DiscoverFilters): Record<string, string> {
  const params: Record<string, string> = {};
  const isTV = filters.mediaType === 'tv';

  // Genre
  if (filters.genre) {
    params.with_genres = String(filters.genre);
  }

  // Year / decade
  if (filters.year) {
    if (/^\d{4}$/.test(filters.year)) {
      // Specific year like "2025"
      if (isTV) {
        params.first_air_date_year = filters.year;
      } else {
        params.primary_release_year = filters.year;
      }
    } else if (filters.year.endsWith('s')) {
      // Decade like "2020s"
      const decade = parseInt(filters.year);
      const gte = `${decade}-01-01`;
      const lte = `${decade + 9}-12-31`;
      if (isTV) {
        params['first_air_date.gte'] = gte;
        params['first_air_date.lte'] = lte;
      } else {
        params['primary_release_date.gte'] = gte;
        params['primary_release_date.lte'] = lte;
      }
    } else if (filters.year === 'classic') {
      if (isTV) {
        params['first_air_date.lte'] = '1999-12-31';
      } else {
        params['primary_release_date.lte'] = '1999-12-31';
      }
    }
  }

  // Rating
  if (filters.rating) {
    params['vote_average.gte'] = String(filters.rating);
    params['vote_count.gte'] = '100';
  }

  // Language
  if (filters.language) {
    params.with_original_language = filters.language;
  }

  // Sort
  const sort = filters.sort || DEFAULTS.sort;
  if (sort === 'vote_average.desc') {
    params.sort_by = 'vote_average.desc';
    // Enforce minimum votes so obscure 10-star titles don't dominate
    params['vote_count.gte'] = String(Math.max(Number(params['vote_count.gte'] || '0'), 200));
  } else if (sort === 'newest') {
    params.sort_by = isTV ? 'first_air_date.desc' : 'primary_release_date.desc';
    // Only show released content, not upcoming
    const today = new Date().toISOString().split('T')[0];
    if (isTV) {
      if (!params['first_air_date.lte']) params['first_air_date.lte'] = today;
    } else {
      if (!params['primary_release_date.lte']) params['primary_release_date.lte'] = today;
    }
  } else {
    params.sort_by = 'popularity.desc';
  }

  // Page
  if (filters.page && filters.page > 1) {
    params.page = String(filters.page);
  }

  return params;
}
