import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { dismissHistoryItem, clearCachedRecs } from '@/api/mongodb-user';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tmdbId, type } = body ?? {};
    const id = Number(tmdbId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid tmdbId' }, { status: 400 });
    }
    if (type !== 'movie' && type !== 'tvshow') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    await dismissHistoryItem(session.user.id, id, type);
    // Invalidate recs cache so dismissed items don't appear as seeds
    await clearCachedRecs(session.user.id).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Dismiss error:', err);
    return NextResponse.json({ error: 'Dismiss failed' }, { status: 500 });
  }
}
