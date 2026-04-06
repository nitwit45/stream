import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { clearAllUserData } from '@/api/mongodb-user';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await clearAllUserData(session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Clear history error:', err);
    return NextResponse.json({ error: 'Clear failed' }, { status: 500 });
  }
}
