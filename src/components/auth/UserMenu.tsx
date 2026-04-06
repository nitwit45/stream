'use client';

import { useSession, signOut } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export function UserMenu() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (status === 'loading') {
    return <div className="w-8 h-8 rounded-full bg-gray-800 animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="text-sm font-medium px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
      >
        Sign In
      </Link>
    );
  }

  const initial =
    session.user.name?.[0]?.toUpperCase() ||
    session.user.email?.[0]?.toUpperCase() ||
    'U';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-medium hover:ring-2 hover:ring-white/40 transition-all overflow-hidden"
        aria-label="User menu"
      >
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-md shadow-lg py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-800">
            <p className="text-sm text-white font-medium truncate">
              {session.user.name || 'User'}
            </p>
            <p className="text-xs text-gray-400 truncate">{session.user.email}</p>
          </div>
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
          >
            Home
          </Link>
          <Link
            href="/my-list"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
          >
            My List
          </Link>
          <Link
            href="/for-you"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
          >
            For You
          </Link>
          <div className="border-t border-gray-800 my-1" />
          <button
            onClick={async () => {
              if (!confirm('Clear all watch history and recommendations? This cannot be undone.')) return;
              setClearing(true);
              try {
                await fetch('/api/history/clear', { method: 'POST' });
                queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
                queryClient.invalidateQueries({ queryKey: ['recommendations'] });
                queryClient.invalidateQueries({ queryKey: ['mylist'] });
              } catch {}
              setClearing(false);
              setOpen(false);
            }}
            disabled={clearing}
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 disabled:opacity-50"
          >
            {clearing ? 'Clearing...' : 'Clear Watch History'}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
