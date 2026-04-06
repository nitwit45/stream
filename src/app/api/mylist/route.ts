import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { addToMyList, removeFromMyList, getMyList, isInMyList } from '@/api/mongodb-user';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tmdbId = searchParams.get('tmdbId');
  const type = searchParams.get('type') as 'movie' | 'tvshow' | null;

  // If tmdbId + type provided, return status for a single item
  if (tmdbId && type) {
    const inList = await isInMyList(session.user.id, Number(tmdbId), type);
    return NextResponse.json({ inList });
  }

  // Otherwise return full list
  const items = await getMyList(session.user.id);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { tmdbId, type } = await req.json();
    if (!Number.isFinite(Number(tmdbId)) || (type !== 'movie' && type !== 'tvshow')) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
    }
    await addToMyList(session.user.id, Number(tmdbId), type);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('MyList add error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { tmdbId, type } = await req.json();
    if (!Number.isFinite(Number(tmdbId)) || (type !== 'movie' && type !== 'tvshow')) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 });
    }
    await removeFromMyList(session.user.id, Number(tmdbId), type);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('MyList remove error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
