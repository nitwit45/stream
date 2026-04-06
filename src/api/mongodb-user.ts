import { Collection, Document, Db } from 'mongodb';
import clientPromise from '@/lib/mongodb-client';

// User-scoped MongoDB helpers.
// Shares the Auth.js clientPromise for a single connection pool.

export interface WatchHistoryDoc extends Document {
  userId: string;
  tmdbId: number;
  type: 'movie' | 'tvshow';
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  startedAt: Date;
  lastSeenAt: Date;
  completed: boolean;
  dismissed: boolean;
}

// ── MyList ─────────────────────────────────────────────────────────────

export interface MyListDoc extends Document {
  userId: string;
  tmdbId: number;
  type: 'movie' | 'tvshow';
  addedAt: Date;
}

// ── User Feedback ──────────────────────────────────────────────────────

export type FeedbackRating = 'up' | 'down' | 'not_interested';

export interface UserFeedbackDoc extends Document {
  userId: string;
  tmdbId: number;
  type: 'movie' | 'tvshow';
  rating: FeedbackRating;
  at: Date;
}

// ── User Recs Cache ────────────────────────────────────────────────────

export interface UserRecsDoc extends Document {
  userId: string;
  rows: { title: string; items: any[] }[];
  generatedAt: Date;
  expiresAt: Date;
}

let indexesEnsured = false;

async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db();
}

async function ensureIndexes(db: Db) {
  if (indexesEnsured) return;
  const history = db.collection<WatchHistoryDoc>('watch_history');
  await history.createIndex(
    { userId: 1, tmdbId: 1, type: 1, seasonNumber: 1, episodeNumber: 1 },
    { unique: true, name: 'user_item_unique' }
  );
  await history.createIndex({ userId: 1, lastSeenAt: -1 });

  const myList = db.collection<MyListDoc>('user_lists');
  await myList.createIndex({ userId: 1, tmdbId: 1, type: 1 }, { unique: true, name: 'user_list_unique' });
  await myList.createIndex({ userId: 1, addedAt: -1 });

  const feedback = db.collection<UserFeedbackDoc>('user_feedback');
  await feedback.createIndex({ userId: 1, tmdbId: 1, type: 1 }, { unique: true, name: 'user_feedback_unique' });

  const recs = db.collection<UserRecsDoc>('user_recs');
  await recs.createIndex({ userId: 1 }, { unique: true, name: 'user_recs_unique' });
  await recs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

  indexesEnsured = true;
}

export async function getWatchHistoryCollection(): Promise<Collection<WatchHistoryDoc>> {
  const db = await getDb();
  await ensureIndexes(db);
  return db.collection<WatchHistoryDoc>('watch_history');
}

// ── Logging ─────────────────────────────────────────────────────────────

export async function logMovieView(userId: string, tmdbId: number) {
  const col = await getWatchHistoryCollection();
  const now = new Date();
  await col.updateOne(
    { userId, tmdbId, type: 'movie', seasonNumber: null, episodeNumber: null },
    {
      $set: { lastSeenAt: now, dismissed: false },
      $setOnInsert: {
        userId,
        tmdbId,
        type: 'movie',
        seasonNumber: null,
        episodeNumber: null,
        startedAt: now,
        completed: false,
      },
    },
    { upsert: true }
  );
}

export async function logEpisodeView(
  userId: string,
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number
) {
  const col = await getWatchHistoryCollection();
  const now = new Date();
  // For TV shows, we track per-episode rows so we can mark them watched,
  // but Continue Watching is computed per-series (one card per show).
  await col.updateOne(
    { userId, tmdbId, type: 'tvshow', seasonNumber, episodeNumber },
    {
      $set: { lastSeenAt: now, dismissed: false },
      $setOnInsert: {
        userId,
        tmdbId,
        type: 'tvshow',
        seasonNumber,
        episodeNumber,
        startedAt: now,
        completed: false,
      },
    },
    { upsert: true }
  );
  // Unhide the series in Continue Watching if the user previously dismissed it,
  // so the dismiss persists at the series level too.
  await col.updateMany(
    { userId, tmdbId, type: 'tvshow' },
    { $set: { dismissed: false } }
  );
}

// ── Continue Watching ───────────────────────────────────────────────────

interface ShowContentDoc extends Document {
  tmdbId: number;
  type: 'movie' | 'tvshow';
  data: any;
  seasons?: { seasonNumber: number; episodeCount: number }[];
}

interface ContinueItem {
  tmdbId: number;
  type: 'movie' | 'tvshow';
  title: string;
  posterPath: string | null;
  lastSeenAt: Date;
  // TV-only: resume target (NEXT episode the user should watch)
  nextSeason?: number;
  nextEpisode?: number;
  // TV-only: label of last watched ep (for display, e.g. "S1:E3")
  lastWatchedLabel?: string;
}

/**
 * Return the "Continue Watching" list for a user.
 *
 * Movies: one row per movie, shown until dismissed or marked completed.
 * TV shows: one row per SERIES (not per episode). Deep-links to the NEXT
 * episode after the most recently watched one (Netflix "resume" behavior).
 * We can't read playback time from the vidsrc iframe, so "resume" = next ep.
 */
export async function getContinueWatching(
  userId: string,
  limit = 20
): Promise<ContinueItem[]> {
  const db = await getDb();
  await ensureIndexes(db);
  const history = db.collection<WatchHistoryDoc>('watch_history');
  const content = db.collection<ShowContentDoc>('content');

  // Pull recent history rows, newest first. Grab more than `limit` so we can
  // collapse TV episodes to one-per-series without running short.
  const rows = await history
    .find({ userId, dismissed: { $ne: true }, completed: { $ne: true } })
    .sort({ lastSeenAt: -1 })
    .limit(limit * 5)
    .toArray();

  // Collapse to one-per-(tmdbId,type), keeping the most recent row.
  const latestByKey = new Map<string, WatchHistoryDoc>();
  for (const row of rows) {
    const key = `${row.type}:${row.tmdbId}`;
    if (!latestByKey.has(key)) latestByKey.set(key, row);
  }

  // Look up metadata for all referenced tmdb ids in one query.
  const ids = Array.from(latestByKey.values()).map((r) => ({
    tmdbId: r.tmdbId,
    type: r.type,
  }));
  if (ids.length === 0) return [];
  const contentDocs = await content
    .find({ $or: ids.map((i) => ({ tmdbId: i.tmdbId, type: i.type })) })
    .toArray();
  const contentIndex = new Map<string, ShowContentDoc>();
  for (const doc of contentDocs) {
    contentIndex.set(`${doc.type}:${doc.tmdbId}`, doc);
  }

  const result: ContinueItem[] = [];
  for (const row of Array.from(latestByKey.values()).slice(0, limit)) {
    const key = `${row.type}:${row.tmdbId}`;
    const meta = contentIndex.get(key);
    const data = meta?.data ?? {};
    const title =
      (data.title as string) || (data.name as string) || `#${row.tmdbId}`;
    const posterPath = (data.poster_path as string) ?? null;

    if (row.type === 'movie') {
      result.push({
        tmdbId: row.tmdbId,
        type: 'movie',
        title,
        posterPath,
        lastSeenAt: row.lastSeenAt,
      });
    } else {
      // TV: compute next episode from the show's seasons metadata.
      const next = computeNextEpisode(
        meta,
        row.seasonNumber ?? 1,
        row.episodeNumber ?? 1
      );
      if (next.completed) continue; // watched finale — don't show
      result.push({
        tmdbId: row.tmdbId,
        type: 'tvshow',
        title,
        posterPath,
        lastSeenAt: row.lastSeenAt,
        nextSeason: next.season,
        nextEpisode: next.episode,
        lastWatchedLabel: `S${row.seasonNumber}:E${row.episodeNumber}`,
      });
    }
  }

  return result;
}

function computeNextEpisode(
  show: ShowContentDoc | undefined,
  currentSeason: number,
  currentEpisode: number
): { season: number; episode: number; completed: boolean } {
  // If we don't have metadata, be optimistic and return next episode.
  // The episode page has vidsrc source fallbacks if the episode doesn't exist.
  if (!show?.seasons || show.seasons.length === 0) {
    return { season: currentSeason, episode: currentEpisode + 1, completed: false };
  }
  const season = show.seasons.find((s) => s.seasonNumber === currentSeason);
  if (season && currentEpisode < season.episodeCount) {
    return { season: currentSeason, episode: currentEpisode + 1, completed: false };
  }
  // Move to next season
  const nextSeason = show.seasons.find((s) => s.seasonNumber === currentSeason + 1);
  if (nextSeason) {
    return { season: currentSeason + 1, episode: 1, completed: false };
  }
  // No more seasons — they finished the series.
  return { season: currentSeason, episode: currentEpisode, completed: true };
}

// ── Dismiss ─────────────────────────────────────────────────────────────

export async function dismissHistoryItem(
  userId: string,
  tmdbId: number,
  type: 'movie' | 'tvshow'
) {
  const col = await getWatchHistoryCollection();
  await col.updateMany({ userId, tmdbId, type }, { $set: { dismissed: true } });
}

// ── My List ─────────────────────────────────────────────────────────────

export async function addToMyList(userId: string, tmdbId: number, type: 'movie' | 'tvshow') {
  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<MyListDoc>('user_lists');
  await col.updateOne(
    { userId, tmdbId, type },
    { $set: { userId, tmdbId, type, addedAt: new Date() } },
    { upsert: true }
  );
}

export async function removeFromMyList(userId: string, tmdbId: number, type: 'movie' | 'tvshow') {
  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<MyListDoc>('user_lists');
  await col.deleteOne({ userId, tmdbId, type });
}

export async function getMyList(userId: string, limit = 50) {
  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<MyListDoc>('user_lists');
  const docs = await col.find({ userId }).sort({ addedAt: -1 }).limit(limit).toArray();

  // Hydrate with content metadata
  const content = db.collection('content');
  const ids = docs.map((d) => ({ tmdbId: d.tmdbId, type: d.type }));
  if (ids.length === 0) return [];
  const contentDocs = await content
    .find({ $or: ids.map((i) => ({ tmdbId: i.tmdbId, type: i.type })) })
    .toArray();
  const contentMap = new Map(contentDocs.map((c) => [`${c.type}:${c.tmdbId}`, c]));

  return docs.map((d) => {
    const meta = contentMap.get(`${d.type}:${d.tmdbId}`);
    const data = meta?.data ?? {};
    return {
      tmdbId: d.tmdbId,
      type: d.type,
      title: (data.title as string) || (data.name as string) || `#${d.tmdbId}`,
      posterPath: (data.poster_path as string) ?? null,
      addedAt: d.addedAt,
    };
  });
}

export async function isInMyList(userId: string, tmdbId: number, type: 'movie' | 'tvshow'): Promise<boolean> {
  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<MyListDoc>('user_lists');
  const doc = await col.findOne({ userId, tmdbId, type });
  return !!doc;
}

// ── Feedback ────────────────────────────────────────────────────────────

export async function setFeedback(
  userId: string,
  tmdbId: number,
  type: 'movie' | 'tvshow',
  rating: FeedbackRating
) {
  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<UserFeedbackDoc>('user_feedback');
  await col.updateOne(
    { userId, tmdbId, type },
    { $set: { userId, tmdbId, type, rating, at: new Date() } },
    { upsert: true }
  );
}

export async function removeFeedback(userId: string, tmdbId: number, type: 'movie' | 'tvshow') {
  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<UserFeedbackDoc>('user_feedback');
  await col.deleteOne({ userId, tmdbId, type });
}

export async function getFeedback(
  userId: string,
  tmdbId: number,
  type: 'movie' | 'tvshow'
): Promise<FeedbackRating | null> {
  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<UserFeedbackDoc>('user_feedback');
  const doc = await col.findOne({ userId, tmdbId, type });
  return doc?.rating ?? null;
}

export async function getUserFeedbackBulk(
  userId: string,
  items: { tmdbId: number; type: 'movie' | 'tvshow' }[]
): Promise<Map<string, FeedbackRating>> {
  if (items.length === 0) return new Map();
  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<UserFeedbackDoc>('user_feedback');
  const docs = await col
    .find({ userId, $or: items.map((i) => ({ tmdbId: i.tmdbId, type: i.type })) })
    .toArray();
  return new Map(docs.map((d) => [`${d.type}:${d.tmdbId}`, d.rating]));
}

// ── Recs Cache ──────────────────────────────────────────────────────────

export async function getCachedRecs(userId: string): Promise<UserRecsDoc | null> {
  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<UserRecsDoc>('user_recs');
  return col.findOne({ userId, expiresAt: { $gt: new Date() } });
}

export async function setCachedRecs(userId: string, rows: { title: string; items: any[] }[]) {
  const db = await getDb();
  await ensureIndexes(db);
  const col = db.collection<UserRecsDoc>('user_recs');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour TTL
  await col.updateOne(
    { userId },
    { $set: { userId, rows, generatedAt: now, expiresAt } },
    { upsert: true }
  );
}

export async function clearCachedRecs(userId: string) {
  const db = await getDb();
  const col = db.collection<UserRecsDoc>('user_recs');
  await col.deleteOne({ userId });
}

export async function clearAllUserData(userId: string) {
  const db = await getDb();
  await Promise.all([
    db.collection('watch_history').deleteMany({ userId }),
    db.collection('user_recs').deleteOne({ userId }),
    db.collection('user_feedback').deleteMany({ userId }),
  ]);
}

// ── Watch History helpers for recs ──────────────────────────────────────

export async function getRecentWatchHistory(userId: string, limit = 30) {
  const col = await getWatchHistoryCollection();
  return col
    .find({ userId, dismissed: { $ne: true } })
    .sort({ lastSeenAt: -1 })
    .limit(limit)
    .toArray();
}

// ── Notifications ───────────────────────────────────────────────────────

export interface NotificationDoc extends Document {
  userId: string;
  kind: 'new_episode';
  tmdbId: number;
  season?: number;
  episode?: number;
  title?: string;
  createdAt: Date;
  readAt?: Date | null;
}

async function notificationsCol() {
  const db = await getDb();
  return db.collection<NotificationDoc>('user_notifications');
}

export async function getNotifications(userId: string, limit = 20) {
  const col = await notificationsCol();
  return col.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function getUnreadCount(userId: string): Promise<number> {
  const col = await notificationsCol();
  return col.countDocuments({ userId, readAt: null });
}

export async function markNotificationsRead(userId: string) {
  const col = await notificationsCol();
  await col.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
}

export async function createNotification(
  userId: string,
  tmdbId: number,
  season: number,
  episode: number,
  title: string
) {
  const col = await notificationsCol();
  // Avoid duplicate notifications for the same episode
  const existing = await col.findOne({ userId, tmdbId, season, episode });
  if (existing) return;
  await col.insertOne({
    userId,
    kind: 'new_episode',
    tmdbId,
    season,
    episode,
    title,
    createdAt: new Date(),
    readAt: null,
  });
}

// ── Search History ──────────────────────────────────────────────────────

export interface SearchHistoryDoc extends Document {
  userId: string;
  query: string;
  at: Date;
}

export async function saveSearchQuery(userId: string, query: string) {
  const db = await getDb();
  const col = db.collection<SearchHistoryDoc>('search_history');
  // Upsert: if same query exists, update timestamp
  await col.updateOne(
    { userId, query },
    { $set: { userId, query, at: new Date() } },
    { upsert: true }
  );
  // Keep only last 10
  const count = await col.countDocuments({ userId });
  if (count > 10) {
    const oldest = await col.find({ userId }).sort({ at: 1 }).limit(count - 10).toArray();
    const ids = oldest.map((d) => d._id);
    await col.deleteMany({ _id: { $in: ids } });
  }
}

export async function getSearchHistory(userId: string): Promise<string[]> {
  const db = await getDb();
  const col = db.collection<SearchHistoryDoc>('search_history');
  const docs = await col.find({ userId }).sort({ at: -1 }).limit(10).toArray();
  return docs.map((d) => d.query);
}

export async function clearSearchHistory(userId: string) {
  const db = await getDb();
  const col = db.collection<SearchHistoryDoc>('search_history');
  await col.deleteMany({ userId });
}

// ── Trending (real, from user data) ─────────────────────────────────────

export async function getTrendingFromWatchData(limit = 20) {
  const db = await getDb();
  const history = db.collection<WatchHistoryDoc>('watch_history');
  const content = db.collection('content');

  // Aggregate: count unique users who watched each item in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const pipeline = [
    { $match: { lastSeenAt: { $gte: sevenDaysAgo } } },
    { $group: { _id: { tmdbId: '$tmdbId', type: '$type' }, viewers: { $addToSet: '$userId' } } },
    { $project: { tmdbId: '$_id.tmdbId', type: '$_id.type', viewerCount: { $size: '$viewers' }, _id: 0 } },
    { $sort: { viewerCount: -1 as const } },
    { $limit: limit },
  ];

  const trending = await history.aggregate(pipeline).toArray();
  if (trending.length === 0) return [];

  // Hydrate with content metadata
  const contentDocs = await content
    .find({ $or: trending.map((t) => ({ tmdbId: t.tmdbId, type: t.type })) })
    .toArray();
  const contentMap = new Map(contentDocs.map((c) => [`${c.type}:${c.tmdbId}`, c]));

  return trending.map((t) => {
    const meta = contentMap.get(`${t.type}:${t.tmdbId}`);
    const data = meta?.data ?? {};
    return {
      tmdbId: t.tmdbId,
      type: t.type,
      title: (data.title as string) || (data.name as string) || `#${t.tmdbId}`,
      posterPath: (data.poster_path as string) ?? null,
      rating: data.vote_average as number | undefined,
      releaseDate: (data.release_date as string) || (data.first_air_date as string),
      viewerCount: t.viewerCount,
    };
  });
}
