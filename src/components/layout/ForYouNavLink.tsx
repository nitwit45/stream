'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export function ForYouNavLink() {
  const { status } = useSession();

  if (status !== 'authenticated') return null;

  return (
    <Link
      href="/for-you"
      className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
    >
      For You
    </Link>
  );
}
