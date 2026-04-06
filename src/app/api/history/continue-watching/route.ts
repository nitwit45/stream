import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getContinueWatching } from '@/api/mongodb-user';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [] });
  }
  try {
    const items = await getContinueWatching(session.user.id, 20);
    return NextResponse.json({ items });
  } catch (err) {
    console.error('Continue watching error:', err);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}
