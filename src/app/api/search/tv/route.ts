import { NextResponse } from 'next/server';
import { searchContent } from '@/api/mongodb';

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
    
    const results = await searchContent(query, 'tvshow');
    return NextResponse.json(results);
  } catch (error) {
    console.error('Error searching TV shows:', error);
    return NextResponse.json(
      { error: 'Failed to search TV shows' },
      { status: 500 }
    );
  }
} 