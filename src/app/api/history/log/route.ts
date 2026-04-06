import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { logMovieView, logEpisodeView, clearCachedRecs } from '@/api/mongodb-user';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tmdbId, type, seasonNumber, episodeNumber } = body ?? {};

    const id = Number(tmdbId);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid tmdbId' }, { status: 400 });
    }
    if (type !== 'movie' && type !== 'tvshow') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    if (type === 'movie') {
      await logMovieView(session.user.id, id);
    } else {
      const s = Number(seasonNumber);
      const e = Number(episodeNumber);
      if (!Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e < 0) {
        return NextResponse.json(
          { error: 'seasonNumber and episodeNumber required for tvshow' },
          { status: 400 }
        );
      }
      await logEpisodeView(session.user.id, id, s, e);
    }

    // Invalidate recs cache so "Because you watched" updates
    await clearCachedRecs(session.user.id).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('History log error:', err);
    return NextResponse.json({ error: 'Log failed' }, { status: 500 });
  }
}
