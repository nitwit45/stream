import { NextResponse } from 'next/server';
import { getContentById } from '@/api/mongodb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const movieId = parseInt(params.id, 10);
    if (isNaN(movieId)) {
      return NextResponse.json(
        { error: 'Invalid movie ID' },
        { status: 400 }
      );
    }

    const movie = await getContentById(movieId, 'movie');
    if (!movie) {
      return NextResponse.json(null);
    }
    
    return NextResponse.json(movie);
  } catch (error) {
    console.error('Error fetching movie details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch movie details' },
      { status: 500 }
    );
  }
} 