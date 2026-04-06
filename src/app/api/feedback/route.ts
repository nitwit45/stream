import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { setFeedback, removeFeedback, getFeedback } from '@/api/mongodb-user';
import type { FeedbackRating } from '@/api/mongodb-user';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tmdbId = Number(searchParams.get('tmdbId'));
  const type = searchParams.get('type') as 'movie' | 'tvshow' | null;
  if (!Number.isFinite(tmdbId) || !type) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
  }

  const rating = await getFeedback(session.user.id, tmdbId, type);
  return NextResponse.json({ rating });
}

const VALID_RATINGS: FeedbackRating[] = ['up', 'down', 'not_interested'];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { tmdbId, type, rating } = await req.json();
    if (!Number.isFinite(Number(tmdbId)) || (type !== 'movie' && type !== 'tvshow')) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
    }

    // rating === null means "remove feedback"
    if (rating === null) {
      await removeFeedback(session.user.id, Number(tmdbId), type);
      return NextResponse.json({ success: true });
    }

    if (!VALID_RATINGS.includes(rating)) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    await setFeedback(session.user.id, Number(tmdbId), type, rating);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Feedback error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
