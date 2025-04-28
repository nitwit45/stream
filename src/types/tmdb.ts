export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  runtime: number;
  original_language: string;
  genres: {
    id: number;
    name: string;
  }[];
}

export interface TVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  episode_run_time: number[];
  original_language: string;
  genres: {
    id: number;
    name: string;
  }[];
  number_of_seasons: number;
  number_of_episodes: number;
} 