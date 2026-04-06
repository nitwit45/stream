import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getNotifications, getUnreadCount, markNotificationsRead } from '@/api/mongodb-user';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [items, unread] = await Promise.all([
    getNotifications(session.user.id),
    getUnreadCount(session.user.id),
  ]);

  return NextResponse.json({ items, unread });
}

// POST = mark all as read
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await markNotificationsRead(session.user.id);
  return NextResponse.json({ success: true });
}
