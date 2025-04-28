import { NextResponse } from 'next/server';
import { getContentById } from '@/api/mongodb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tvId = parseInt(params.id, 10);
    if (isNaN(tvId)) {
      return NextResponse.json(
        { error: 'Invalid TV show ID' },
        { status: 400 }
      );
    }

    const tvShow = await getContentById(tvId, 'tvshow');
    if (!tvShow) {
      return NextResponse.json(null);
    }
    
    return NextResponse.json(tvShow);
  } catch (error) {
    console.error('Error fetching TV show details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TV show details' },
      { status: 500 }
    );
  }
} 