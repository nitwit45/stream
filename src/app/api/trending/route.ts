import { NextResponse } from 'next/server';
import { getTrendingFromWatchData } from '@/api/mongodb-user';

// Public endpoint — no auth required. Shows trending across all users.
export async function GET() {
  try {
    const items = await getTrendingFromWatchData(20);
    return NextResponse.json({ items });
  } catch (err) {
    console.error('Trending error:', err);
    return NextResponse.json({ items: [] });
  }
}
