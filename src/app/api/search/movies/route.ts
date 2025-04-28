import { NextResponse } from 'next/server';
import { searchMovies } from '@/api/tmdb';
import { filterAvailableContent } from '@/api/mongodb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }
    
    // Search for movies
    const movies = await searchMovies(query, 1);
    
    // Filter available movies
    const availableMovies = await filterAvailableContent(movies.results, 'movie');
    
    // Return filtered results
    return NextResponse.json({
      ...movies,
      results: availableMovies,
      total_results: availableMovies.length,
      total_pages: Math.ceil(availableMovies.length / 20)
    });
  } catch (error) {
    console.error('Error searching movies:', error);
    return NextResponse.json(
      { error: 'Failed to search movies' },
      { status: 500 }
    );
  }
} 