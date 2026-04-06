import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getRecentWatchHistory,
  getUserFeedbackBulk,
  getCachedRecs,
  setCachedRecs,
} from '@/api/mongodb-user';

import { GENRE_NAME_BY_ID } from '@/lib/genres';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY!;

async function tmdbFetch(path: string): Promise<any> {
  const res = await fetch(`${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${API_KEY}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ rows: [] });
  }

  const userId = session.user.id;

  // Check cache first (1-hour TTL)
  const cached = await getCachedRecs(userId);
  if (cached) {
    return NextResponse.json({ rows: cached.rows });
  }

  try {
    const rows = await generateRecs(userId);
    // Cache for 1 hour
    await setCachedRecs(userId, rows).catch(() => {});
    return NextResponse.json({ rows });
  } catch (err) {
    console.error('Recs error:', err);
    return NextResponse.json({ rows: [] });
  }
}

async function generateRecs(userId: string) {
  // 1. Pull recent watch history
  const history = await getRecentWatchHistory(userId, 30);
  if (history.length === 0) return [];

  // 2. Get user feedback to filter out downvoted
  const feedbackItems = history.map((h) => ({ tmdbId: h.tmdbId, type: h.type }));
  const feedback = await getUserFeedbackBulk(userId, feedbackItems);

  // Deduplicate by tmdbId+type, weight by recency
  const seen = new Map<string, { tmdbId: number; type: 'movie' | 'tvshow'; weight: number }>();
  const watchedSet = new Set<string>();
  const genreCounts = new Map<number, number>();

  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    const key = `${h.type}:${h.tmdbId}`;
    watchedSet.add(key);

    // Skip downvoted for rec seeds
    const fb = feedback.get(key);
    if (fb === 'down' || fb === 'not_interested') continue;

    const existing = seen.get(key);
    const weight = 1 / (i + 1); // recency weight
    if (existing) {
      existing.weight += weight;
    } else {
      seen.set(key, { tmdbId: h.tmdbId, type: h.type, weight });
    }
  }

  // Sort by weight, take top 5 seeds
  const seeds = Array.from(seen.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  const rows: { title: string; items: any[]; rowType: string; seedId?: number; seedType?: string; genreId?: number }[] = [];

  // 3. "Because you watched X" rows — TMDB /recommendations for top seeds
  const recPromises = seeds.map(async (seed) => {
    const endpoint = seed.type === 'movie' ? 'movie' : 'tv';
    const data = await tmdbFetch(`/${endpoint}/${seed.tmdbId}/recommendations`);
    if (!data?.results) return null;

    // Also fetch the seed's details for the row title + genre affinity
    const details = await tmdbFetch(`/${endpoint}/${seed.tmdbId}`);
    const seedTitle = details?.title || details?.name || `#${seed.tmdbId}`;
    const seedGenres: number[] = (details?.genres || []).map((g: any) => g.id);
    seedGenres.forEach((gid) => genreCounts.set(gid, (genreCounts.get(gid) || 0) + seed.weight));

    // Filter: not already watched, not downvoted
    const filtered = data.results.filter((item: any) => {
      const key = `${seed.type}:${item.id}`;
      return !watchedSet.has(key);
    }).slice(0, 12);

    if (filtered.length === 0) return null;
    return { title: `Because you watched ${seedTitle}`, items: filtered, rowType: 'similar', seedId: seed.tmdbId, seedType: seed.type };
  });

  const recResults = await Promise.all(recPromises);
  for (const r of recResults) {
    if (r) rows.push(r);
  }

  // 4. Genre affinity — top 2 genres
  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  for (const [genreId] of topGenres) {
    const genreName = GENRE_NAME_BY_ID[genreId] || `Genre ${genreId}`;
    const data = await tmdbFetch(`/discover/movie?with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=100`);
    if (!data?.results) continue;

    const filtered = data.results
      .filter((item: any) => !watchedSet.has(`movie:${item.id}`))
      .slice(0, 12);

    if (filtered.length > 0) {
      rows.push({ title: `Top in ${genreName}`, items: filtered, rowType: 'genre', genreId });
    }
  }

  return rows;
}
