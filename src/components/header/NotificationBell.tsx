'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Notification {
  _id: string;
  kind: 'new_episode';
  tmdbId: number;
  season?: number;
  episode?: number;
  title?: string;
  createdAt: string;
  readAt: string | null;
}

export function NotificationBell() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) return { items: [], unread: 0 };
      return res.json();
    },
    enabled: status === 'authenticated',
    staleTime: 30_000,
    refetchInterval: 60_000, // poll every minute
  });

  const markRead = useMutation({
    mutationFn: async () => {
      await fetch('/api/notifications', { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (status !== 'authenticated') return null;

  const items: Notification[] = data?.items ?? [];
  const unread: number = data?.unread ?? 0;

  const handleOpen = () => {
    setOpen(!open);
    if (!open && unread > 0) {
      markRead.mutate();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative text-gray-300 hover:text-white transition-colors p-1"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {items.length > 0 && (
              <button
                onClick={() => markRead.mutate()}
                className="text-xs text-gray-400 hover:text-white"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">No notifications yet</p>
            ) : (
              items.map((n) => (
                <Link
                  key={n._id}
                  href={`/tv/${n.tmdbId}/season/${n.season}/episode/${n.episode}`}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-3 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-0 ${
                    !n.readAt ? 'bg-gray-800/50' : ''
                  }`}
                >
                  <p className="text-sm">
                    <span className="font-medium">{n.title}</span>
                    {' '}S{n.season}:E{n.episode} is now available
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
