import { MongoClient, Collection, IndexSpecification, Document, Db } from 'mongodb';
import { Movie, TVShow, Season, Episode } from '@/types/tmdb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// This file should only be imported by server components or API routes
// Check for server-side execution
const isServer = typeof window === 'undefined';

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

interface ContentDocument extends Document {
  tmdbId: number;
  type: 'movie' | 'tvshow';
  data: Movie | TVShow;
  seasons?: { 
    seasonNumber: number;
    episodeCount: number;
    episodes?: { 
      episodeNumber: number;
      available: boolean;
      lastChecked: Date;
    }[];
  }[];
  available: boolean;
  lastChecked: Date;
}

const client = new MongoClient(process.env.MONGODB_URI as string);
let db: any = null;
let contentCollection: Collection<ContentDocument> | null = null;

export async function connectToDatabase() {
  if (db) return { db, contentCollection };
  
  try {
    await client.connect();
    db = client.db();
    contentCollection = db.collection('content') as Collection<ContentDocument>;
    
    // Drop legacy single-field tmdbId index (replaced by the unique
    // (tmdbId, type) compound below — tmdbId alone isn't unique because TMDB's
    // movie and tv id-spaces overlap).
    if (contentCollection) {
      try {
        await contentCollection.dropIndex('tmdbId_1');
      } catch (_e) {
        // ignore: index may not exist on fresh DBs
      }
    }

    // Create indexes for faster queries
    const indexes: Array<{ key: IndexSpecification; options?: any }> = [
      { key: { tmdbId: 1, type: 1 }, options: { unique: true, name: 'tmdbId_1_type_1' } },
      { key: { type: 1, available: 1 } },
      { key: { 'data.title': 1 } },
      { key: { 'data.name': 1 } },
      { key: { lastChecked: 1 } },
      { key: { 'seasons.seasonNumber': 1 } },
      { key: { 'seasons.episodes.episodeNumber': 1 } }
    ];

    for (const { key, options } of indexes) {
      try {
        if (contentCollection) {
          await contentCollection.createIndex(key, options);
        }
      } catch (error) {
        console.log(`Index already exists or error creating index:`, error);
      }
    }
    
    return { db, contentCollection };
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

// Add or update season and episode availability
export async function updateTVShowSeasonData(tvId: number, seasons: Season[]) {
  if (!contentCollection) {
    await connectToDatabase();
  }

  const now = new Date();
  
  try {
    // Store season data with episode counts
    const seasonsData = seasons.map(season => ({
      seasonNumber: season.season_number,
      episodeCount: season.episode_count,
      available: true,
      lastChecked: now
    }));
    
    if (contentCollection) {
      await contentCollection.updateOne(
        { tmdbId: tvId, type: 'tvshow' },
        {
          $set: { seasons: seasonsData },
          $setOnInsert: { tmdbId: tvId, type: 'tvshow' }
        },
        { upsert: true }
      );
    }
  } catch (error) {
    console.error(`Error updating TV show season data for ${tvId}:`, error);
  }
}

// Add this function below updateTVShowSeasonData
export async function bulkUpdateTVShowSeasonData(data: Array<{tvId: number, seasons: Season[]}>) {
  if (!contentCollection) {
    await connectToDatabase();
  }

  const now = new Date();
  
  try {
    if (!contentCollection) {
      throw new Error('Content collection not available');
    }
    
    // Prepare bulk operations
    const bulkOps = data.map(item => {
      const seasonsData = item.seasons.map(season => ({
        seasonNumber: season.season_number,
        episodeCount: season.episode_count,
        available: true,
        lastChecked: now
      }));
      
      return {
        updateOne: {
          filter: { tmdbId: item.tvId, type: 'tvshow' as const },
          update: {
            $set: {
              seasons: seasonsData,
              lastChecked: now
            },
            $setOnInsert: { tmdbId: item.tvId, type: 'tvshow' as const }
          },
          upsert: true
        }
      };
    });
    
    if (bulkOps.length > 0) {
      // Execute bulk operation
      await contentCollection.bulkWrite(bulkOps, { ordered: false });
    }
    
    return true;
  } catch (error) {
    console.error(`Error bulk updating TV show season data:`, error);
    return false;
  }
}

// Check and update episode availability
export async function checkAndUpdateEpisodeAvailability(
  tvId: number, 
  seasonNumber: number, 
  episodeNumber: number
) {
  if (!contentCollection) {
    await connectToDatabase();
  }

  const now = new Date();
  
  try {
    // Check if we already have this episode cached
    const tvShow = contentCollection ?
      await contentCollection.findOne({
        tmdbId: tvId,
        type: 'tvshow',
        'seasons.seasonNumber': seasonNumber
      }) : null;
    
    let episodeAvailability = null;
    
    if (tvShow) {
      const season = tvShow.seasons?.find(s => s.seasonNumber === seasonNumber);
      if (season) {
        const episode = season.episodes?.find(e => e.episodeNumber === episodeNumber);
        if (episode && (now.getTime() - episode.lastChecked.getTime() < 24 * 60 * 60 * 1000)) {
          return episode.available;
        }
      }
    }
    
    // Check with VidSrc if episode is available
    const episodeUrl = `https://vsembed.ru/embed/tv/${tvId}/${seasonNumber}-${episodeNumber}`;
    const response = await fetch(episodeUrl);
    const isAvailable = response.ok;
    
    // Update or insert the episode availability
    if (contentCollection) {
      // First ensure we have the TV show and season
      await contentCollection.updateOne(
        { tmdbId: tvId, type: 'tvshow' },
        {
          $setOnInsert: {
            tmdbId: tvId,
            type: 'tvshow',
            available: true,
            lastChecked: now
          }
        },
        { upsert: true }
      );

      // Check if the season exists
      const seasonExists = await contentCollection.findOne({
        tmdbId: tvId,
        type: 'tvshow',
        'seasons.seasonNumber': seasonNumber
      });

      if (!seasonExists) {
        // Add the season if it doesn't exist
        await contentCollection.updateOne(
          { tmdbId: tvId, type: 'tvshow' },
          {
            $push: {
              seasons: {
                seasonNumber,
                episodeCount: 0,  // Will be updated later
                episodes: [],
                lastChecked: now
              } as any
            }
          }
        );
      }

      // Update or add the episode
      await contentCollection.updateOne(
        {
          tmdbId: tvId,
          type: 'tvshow',
          'seasons.seasonNumber': seasonNumber
        },
        {
          $set: {
            lastChecked: now,
            'seasons.$.lastChecked': now
          },
          $addToSet: {
            'seasons.$.episodes': {
              episodeNumber,
              available: isAvailable,
              lastChecked: now
            }
          }
        }
      );
      
      // If the episode already exists, update it
      await contentCollection.updateOne(
        {
          tmdbId: tvId,
          type: 'tvshow',
          'seasons.seasonNumber': seasonNumber,
          'seasons.episodes.episodeNumber': episodeNumber
        },
        {
          $set: {
            'seasons.$[season].episodes.$[episode].available': isAvailable,
            'seasons.$[season].episodes.$[episode].lastChecked': now
          }
        },
        {
          arrayFilters: [
            { 'season.seasonNumber': seasonNumber },
            { 'episode.episodeNumber': episodeNumber }
          ]
        }
      );
    }
    
    return isAvailable;
  } catch (error) {
    console.error(`Error checking/updating episode availability for TV ${tvId} S${seasonNumber}E${episodeNumber}:`, error);
    return false;
  }
}

// Probe a vidsrc URL with retries + backoff. Returns a definitive yes/no only
// when vidsrc responds with a real 2xx or 4xx (non-rate-limit). 429/503/network
// errors return { status: 'ratelimited' } so the caller can preserve state.
type VidsrcResult = { status: 'ok'; available: boolean } | { status: 'ratelimited' };
async function checkVidsrc(url: string, maxAttempts = 4): Promise<VidsrcResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.status === 429 || res.status === 503) {
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
          continue;
        }
        return { status: 'ratelimited' };
      }
      // 2xx = available; 4xx (non-429) = not available
      return { status: 'ok', available: res.ok };
    } catch (_e) {
      // network error — retry
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
        continue;
      }
      return { status: 'ratelimited' };
    }
  }
  return { status: 'ratelimited' };
}

export async function checkAndCacheAvailability(content: Movie | TVShow, type: 'movie' | 'tvshow'): Promise<boolean> {
  if (!contentCollection) {
    await connectToDatabase();
  }

  const tmdbId = content.id;
  const now = new Date();
  
  try {
    // Check if we already have this content cached (scoped by type — TMDB movie
    // and tv id-spaces overlap, so filtering by tmdbId alone can hit the wrong doc)
    const existing = contentCollection ? await contentCollection.findOne({ tmdbId, type }) : null;

    if (existing) {
      const ageMs = now.getTime() - existing.lastChecked.getTime();
      const ttl = existing.available ? CACHE_FRESH_AVAILABLE_MS : CACHE_FRESH_UNAVAILABLE_MS;
      if (ageMs < ttl) return existing.available;
    }

    // Check availability with Vidsrc (with retries on 429/503/network errors).
    // If all retries fail, we treat the result as "unknown" and preserve the
    // existing availability flag — we must NOT flip an available title to
    // unavailable just because vidsrc rate-limited us.
    const streamUrl = type === 'movie'
      ? `https://vsembed.ru/embed/movie/${tmdbId}`
      : `https://vsembed.ru/embed/tv/${tmdbId}/1/1`;

    const checkResult = await checkVidsrc(streamUrl);

    // Update or insert the content
    if (contentCollection) {
      // For TV shows, try to store seasons and episodes info
      if (type === 'tvshow') {
        const tvShow = content as TVShow;
        if (tvShow.seasons) {
          await updateTVShowSeasonData(tmdbId, tvShow.seasons);
        }
      }

      if (checkResult.status === 'ok') {
        // Got a definitive yes/no from vidsrc — write all fields.
        await contentCollection.updateOne(
          { tmdbId, type },
          {
            $set: {
              tmdbId,
              type,
              data: content,
              available: checkResult.available,
              lastChecked: now
            }
          },
          { upsert: true }
        );
        return checkResult.available;
      } else {
        // Rate-limited / network failure after retries. Refresh TMDB metadata
        // but DO NOT touch `available` or `lastChecked` — the next run will retry.
        // For new items, insert optimistically as available=true so they show up;
        // a future run with a clean vidsrc response will correct if wrong.
        if (existing) {
          await contentCollection.updateOne(
            { tmdbId, type },
            { $set: { data: content } }
          );
          return existing.available;
        } else {
          // Optimistic insert with lastChecked epoch-0 so next run re-verifies immediately.
          await contentCollection.updateOne(
            { tmdbId, type },
            {
              $set: { tmdbId, type, data: content, available: true, lastChecked: new Date(0) }
            },
            { upsert: true }
          );
          return true;
        }
      }
    }

    return checkResult.status === 'ok' ? checkResult.available : false;
  } catch (error) {
    console.error(`Error checking availability for ${type} ${tmdbId}:`, error);
    return false;
  }
}

export async function filterAvailableContent<T extends Movie | TVShow>(
  content: T[],
  type: 'movie' | 'tvshow'
): Promise<T[]> {
  if (!contentCollection) {
    await connectToDatabase();
  }

  const availableContent: T[] = [];
  const batchSize = 10;
  
  for (let i = 0; i < content.length; i += batchSize) {
    const batch = content.slice(i, i + batchSize);
    const availabilityChecks = batch.map(item => checkAndCacheAvailability(item, type));
    const results = await Promise.all(availabilityChecks);
    
    results.forEach((isAvailable, index) => {
      if (isAvailable) {
        availableContent.push(batch[index]);
      }
    });
  }

  return availableContent;
}

export async function cleanupOldContent() {
  if (!contentCollection) {
    await connectToDatabase();
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    if (contentCollection) {
      await contentCollection.deleteMany({
        lastChecked: { $lt: sevenDaysAgo }
      });
    }
  } catch (error) {
    console.error('Error cleaning up old content:', error);
  }
}

export async function updatePopularContent() {
  if (!contentCollection) {
    await connectToDatabase();
  }

  try {
    // Fetch all popular movies and TV shows
    const [movies, tvShows] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`)
        .then(res => res.json())
        .then(data => data.results as Movie[]),
      fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`)
        .then(res => res.json())
        .then(data => data.results as TVShow[])
    ]);

    // Process in batches
    const batchSize = 10;
    const allContent = [...movies, ...tvShows];
    
    for (let i = 0; i < allContent.length; i += batchSize) {
      const batch = allContent.slice(i, i + batchSize);
      const type = i < movies.length ? 'movie' : 'tvshow';
      
      await Promise.all(
        batch.map(content => checkAndCacheAvailability(content, type))
      );
    }

    console.log('Popular content updated successfully');
  } catch (error) {
    console.error('Error updating popular content:', error);
  }
}

// TMDB discover has a hard 500-page cap per endpoint (20 items/page = 10k items max).
// Honored via Math.min(total_pages, TMDB_MAX_PAGES).
const TMDB_MAX_PAGES = 500;

// vidsrc rate-limits by IP. Keep concurrency low and delays generous so the
// sync script never burns through the same IP's quota that the user's browser
// needs to load iframes. Script can run overnight — throughput isn't the goal.
const VIDSRC_CONCURRENCY = 1;
const VIDSRC_BATCH_DELAY_MS = 500;
// Split cache freshness: once vidsrc confirms a title is available, it stays
// available for a long time, so don't re-verify for 30 days. "Not available"
// items get re-checked sooner since new titles come online frequently.
const CACHE_FRESH_AVAILABLE_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_FRESH_UNAVAILABLE_MS = 7 * 24 * 60 * 60 * 1000;

// Override range via env, e.g. FETCH_START_PAGE=1 FETCH_END_PAGE=3 for a smoke test.
function getPageRange(): { start: number; end: number } {
  const start = Math.max(1, parseInt(process.env.FETCH_START_PAGE || '1', 10));
  const envEnd = parseInt(process.env.FETCH_END_PAGE || '', 10);
  const end = Number.isFinite(envEnd) && envEnd > 0 ? envEnd : TMDB_MAX_PAGES;
  return { start, end };
}

type DiscoverPage = { results: any[]; total_pages: number; page: number } | null;

async function fetchTMDBDiscover(
  endpoint: 'movie' | 'tv',
  page: number,
  attempt = 1
): Promise<DiscoverPage> {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  const url = `https://api.themoviedb.org/3/discover/${endpoint}?api_key=${apiKey}&page=${page}&sort_by=popularity.desc`;
  try {
    const res = await fetch(url);
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 4) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
        return fetchTMDBDiscover(endpoint, page, attempt + 1);
      }
      return null;
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.results)) return null;
    return { results: data.results, total_pages: data.total_pages || 0, page };
  } catch (_e) {
    if (attempt < 4) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
      return fetchTMDBDiscover(endpoint, page, attempt + 1);
    }
    return null;
  }
}

// Run `fn` over `items` with at most `concurrency` in flight at any time.
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

export async function fetchAndCacheAllContent() {
  if (!contentCollection) {
    await connectToDatabase();
  }

  const { start, end } = getPageRange();
  const stats = {
    movie: { processed: 0, available: 0, skipped: 0, pages: 0 },
    tvshow: { processed: 0, available: 0, skipped: 0, pages: 0 }
  };
  const runStart = Date.now();

  async function crawlEndpoint(endpoint: 'movie' | 'tv') {
    const docType: 'movie' | 'tvshow' = endpoint === 'movie' ? 'movie' : 'tvshow';
    const label = endpoint === 'movie' ? 'MOVIES' : 'TV SHOWS';
    console.log(`\n=== ${label}: crawling TMDB discover/${endpoint} ===`);

    // Fetch page 1 (unless starting later) to discover total_pages.
    const probe = await fetchTMDBDiscover(endpoint, start);
    if (!probe) {
      console.error(`[${endpoint}] could not fetch page ${start} from TMDB, aborting this endpoint`);
      return;
    }
    const cappedTotal = Math.min(probe.total_pages, TMDB_MAX_PAGES, end);
    console.log(`[${endpoint}] TMDB reports ${probe.total_pages} pages; crawling pages ${start}..${cappedTotal}`);

    // Small look-ahead buffer of ONE page, fetched while current page processes.
    let nextPagePromise: Promise<DiscoverPage> | null = null;
    let currentResults = probe.results;

    for (let page = start; page <= cappedTotal; page++) {
      if (page > start) {
        const next = await nextPagePromise;
        if (!next || next.results.length === 0) {
          console.log(`[${endpoint}] page ${page} empty or failed, stopping crawl`);
          break;
        }
        currentResults = next.results;
      }

      // Kick off next page fetch concurrently with item processing.
      if (page + 1 <= cappedTotal) {
        nextPagePromise = fetchTMDBDiscover(endpoint, page + 1);
      } else {
        nextPagePromise = null;
      }

      // Bulk-prefetch existing docs for this page so we can fast-path items
      // that are already cached fresh — no vidsrc round-trip, no sleep.
      const pageIds = currentResults.map((r: any) => r.id);
      const existingDocs = contentCollection
        ? await contentCollection.find({ tmdbId: { $in: pageIds }, type: docType }).toArray()
        : [];
      const existingMap = new Map(existingDocs.map(d => [d.tmdbId, d]));
      const now = Date.now();

      const itemLabel = docType === 'movie' ? 'Movie' : 'TV Show';
      const toCheck: any[] = [];

      for (const item of currentResults) {
        const cached = existingMap.get(item.id);
        const ttl = cached?.available ? CACHE_FRESH_AVAILABLE_MS : CACHE_FRESH_UNAVAILABLE_MS;
        if (cached && cached.lastChecked && (now - cached.lastChecked.getTime()) < ttl) {
          // Fast path — within TTL (30d if available, 7d if unavailable).
          stats[docType].processed++;
          stats[docType].skipped++;
          if (cached.available) stats[docType].available++;
          const n = stats[docType].processed;
          const title = item.title || item.name || `id=${item.id}`;
          console.log(`[${n}] ${itemLabel}: ${title} - ${cached.available ? 'Available' : 'Not Available'} (cached)`);
        } else {
          toCheck.push(item);
        }
      }

      // Slow path — only items that are new or stale hit vidsrc.
      await runWithConcurrency(toCheck, VIDSRC_CONCURRENCY, async (item) => {
        const isAvailable = await checkAndCacheAvailability(item, docType);
        stats[docType].processed++;
        if (isAvailable) stats[docType].available++;
        const n = stats[docType].processed;
        const title = item.title || item.name || `id=${item.id}`;
        console.log(`[${n}] ${itemLabel}: ${title} - ${isAvailable ? 'Available' : 'Not Available'}`);
        // Tiny per-item pacing to be polite to vidsrc.
        await new Promise(r => setTimeout(r, VIDSRC_BATCH_DELAY_MS / VIDSRC_CONCURRENCY));
      });

      stats[docType].pages++;
      if (page % 5 === 0 || page === cappedTotal) {
        const elapsed = ((Date.now() - runStart) / 1000).toFixed(0);
        console.log(
          `[${endpoint}] page ${page}/${cappedTotal} — ` +
          `processed: ${stats[docType].processed}, available: ${stats[docType].available} ` +
          `(${elapsed}s elapsed)`
        );
      }
    }
  }

  try {
    await crawlEndpoint('movie');
    await crawlEndpoint('tv');

    const elapsed = ((Date.now() - runStart) / 1000).toFixed(0);
    console.log('\n=== Sync complete ===');
    console.log(`Elapsed: ${elapsed}s`);
    console.log(`Movies:  ${stats.movie.processed} processed across ${stats.movie.pages} pages, ${stats.movie.available} available, ${stats.movie.skipped} cached`);
    console.log(`TV:      ${stats.tvshow.processed} processed across ${stats.tvshow.pages} pages, ${stats.tvshow.available} available, ${stats.tvshow.skipped} cached`);
  } catch (error) {
    console.error('Error fetching all content:', error);
    throw error;
  }
}

export async function getContentByCategory(type: 'movie' | 'tvshow', category: string = 'popular', page: number = 1, limit: number = 20) {
  if (!contentCollection) {
    await connectToDatabase();
  }

  try {
    const skip = (page - 1) * limit;

    // TMDB uses different date fields for movies vs. TV (release_date vs. first_air_date).
    const dateField = type === 'movie' ? 'data.release_date' : 'data.first_air_date';

    // Build the query based on category
    let query: any = { type, available: true };

    switch (category) {
      case 'popular':
        // Sort by TMDB popularity score
        query = { ...query, 'data.popularity': { $exists: true } };
        break;
      case 'latest':
        // Sort by release / first-air date
        query = { ...query, [dateField]: { $exists: true, $ne: '' } };
        break;
      case 'top_rated':
        // Sort by vote average
        query = { ...query, 'data.vote_average': { $exists: true } };
        break;
      default:
        // For other categories, ensure the field exists
        if (category) {
          query = { ...query, [`data.${category}`]: { $exists: true } };
        }
    }

    // Get total count for pagination
    const total = await contentCollection!.countDocuments(query);

    // Determine sort order based on category
    let sort: any = {};
    switch (category) {
      case 'popular':
        sort = { 'data.popularity': -1 };
        break;
      case 'latest':
        sort = { [dateField]: -1 };
        break;
      case 'top_rated':
        sort = { 'data.vote_average': -1 };
        break;
      default:
        sort = { 'data.popularity': -1 }; // Default to popularity
    }

    // Fetch the content
    const content = await contentCollection!
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    return {
      content: content.map(item => item.data),
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    };
  } catch (error) {
    console.error(`Error fetching ${type}s by category ${category}:`, error);
    throw error;
  }
}

export async function cleanupOldCache() {
  if (!contentCollection) {
    await connectToDatabase();
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    if (contentCollection) {
      const result = await contentCollection.deleteMany({
        lastChecked: { $lt: thirtyDaysAgo }
      });
      console.log(`Cleaned up ${result.deletedCount} old cache entries`);
      return { success: true, deletedCount: result.deletedCount };
    }
  } catch (error) {
    console.error('Error cleaning up old cache:', error);
    return { success: false, error };
  }
  
  return { success: false, error: 'Collection not available' };
}

export async function getContentById(type: 'movie' | 'tvshow', id: number) {
  if (!contentCollection) {
    await connectToDatabase();
  }

  try {
    if (contentCollection) {
      const content = await contentCollection.findOne({ 
        tmdbId: id,
        type
      });
      
      if (content) {
        return { 
          success: true, 
          content: content.data, 
          available: content.available 
        };
      }
      
      // If not found in cache, fetch directly
      const apiEndpoint = type === 'movie' 
        ? `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
        : `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`;
      
      const response = await fetch(apiEndpoint);
      const data = await response.json();
      
      // Check availability
      const available = await checkAndCacheAvailability(data, type);
      
      return { success: true, content: data, available };
    }
  } catch (error) {
    console.error(`Error getting ${type} by ID ${id}:`, error);
    return { success: false, error };
  }
  
  return { success: false, error: 'Collection not available' };
}

export async function searchContent(type: 'movie' | 'tvshow', query: string, page: number = 1) {
  if (!contentCollection) {
    await connectToDatabase();
  }

  try {
    // First search in TMDB
    const apiEndpoint = type === 'movie'
      ? `https://api.themoviedb.org/3/search/movie?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`
      : `https://api.themoviedb.org/3/search/tv?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`;
    
    const response = await fetch(apiEndpoint);
    const data = await response.json();
    
    const results = data.results || [];
    const totalPages = data.total_pages || 0;
    const totalResults = data.total_results || 0;
    
    // Filter out items that aren't available (by checking our cache)
    if (contentCollection && results.length > 0) {
      const tmdbIds = results.map((item: any) => item.id);
      
      const cachedResults = await contentCollection.find({
        tmdbId: { $in: tmdbIds },
        type,
        available: true
      }).toArray();
      
      const cachedIds = new Set(cachedResults.map(item => item.tmdbId));
      const availableResults = results.filter((item: any) => cachedIds.has(item.id));
      
      return {
        success: true,
        content: availableResults,
        totalPages,
        totalResults: availableResults.length,
        filteredFromOriginal: results.length - availableResults.length
      };
    }
    
    // If no cached results, just return everything (availability will be checked later)
    return {
      success: true,
      content: results,
      totalPages,
      totalResults,
      filteredFromOriginal: 0
    };
  } catch (error) {
    console.error(`Error searching ${type} with query "${query}":`, error);
    return { success: false, error, content: [], totalPages: 0, totalResults: 0 };
  }
} 