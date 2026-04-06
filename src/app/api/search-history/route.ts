import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { saveSearchQuery, getSearchHistory, clearSearchHistory } from '@/api/mongodb-user';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ history: [] });
  }

  const history = await getSearchHistory(session.user.id);
  return NextResponse.json({ history });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
    }
    await saveSearchQuery(session.user.id, query.trim());
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Search history error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await clearSearchHistory(session.user.id);
  return NextResponse.json({ success: true });
}
