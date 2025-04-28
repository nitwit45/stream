import { MongoClient, Collection, IndexSpecification, Document, Db } from 'mongodb';
import { Movie, TVShow } from '@/types/tmdb';
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
    
    // Create indexes for faster queries
    const indexes: IndexSpecification[] = [
      { tmdbId: 1 } as IndexSpecification,
      { type: 1, available: 1 } as IndexSpecification,
      { 'data.title': 1 } as IndexSpecification,
      { 'data.name': 1 } as IndexSpecification,
      { lastChecked: 1 } as IndexSpecification
    ];
    
    for (const index of indexes) {
      try {
        if (contentCollection) {
          await contentCollection.createIndex(index);
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

export async function checkAndCacheAvailability(content: Movie | TVShow, type: 'movie' | 'tvshow') {
  if (!contentCollection) {
    await connectToDatabase();
  }

  const tmdbId = content.id;
  const now = new Date();
  
  try {
    // Check if we already have this content cached
    const existing = contentCollection ? await contentCollection.findOne({ tmdbId }) : null;
    
    if (existing && (now.getTime() - existing.lastChecked.getTime() < 24 * 60 * 60 * 1000)) {
      return existing.available;
    }

    // Check availability with Vidsrc
    const streamUrl = type === 'movie' 
      ? `https://vidsrc.to/embed/movie/${tmdbId}`
      : `https://vidsrc.to/embed/tv/${tmdbId}/1/1`;
    
    const response = await fetch(streamUrl);
    const isAvailable = response.ok;

    // Update or insert the content
    if (contentCollection) {
      await contentCollection.updateOne(
        { tmdbId },
        {
          $set: {
            tmdbId,
            type,
            data: content,
            available: isAvailable,
            lastChecked: now
          }
        },
        { upsert: true }
      );
    }

    return isAvailable;
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

export async function fetchAndCacheAllContent() {
  if (!contentCollection) {
    await connectToDatabase();
  }

  try {
    console.log('Starting to fetch all available content...');
    let page = 1;
    let hasMore = true;
    const batchSize = 20;
    const maxConcurrent = 5;
    const preloadPages = 3; // Number of pages to preload
    let processedCount = 0;
    let preloadedData: Array<{ movies: Movie[]; tvShows: TVShow[] }> = [];

    // Function to preload pages
    async function preloadNextPages(currentPage: number): Promise<Array<{ movies: Movie[]; tvShows: TVShow[] }>> {
      const preloadPromises = [];
      for (let i = 1; i <= preloadPages; i++) {
        const nextPage = currentPage + i;
        preloadPromises.push(
          Promise.all([
            fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&page=${nextPage}`)
              .then(res => res.json())
              .then(data => data.results as Movie[]),
            fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&page=${nextPage}`)
              .then(res => res.json())
              .then(data => data.results as TVShow[])
          ]).then(([movies, tvShows]) => ({ movies, tvShows }))
        );
      }
      return Promise.all(preloadPromises);
    }

    // Initial preload
    preloadedData = await preloadNextPages(0);

    while (hasMore) {
      // Get current page data from preloaded data or fetch if not available
      let currentPageData: { movies: Movie[]; tvShows: TVShow[] };

      if (preloadedData.length > 0) {
        currentPageData = preloadedData.shift()!;
        // Start preloading next pages in the background
        if (hasMore) {
          preloadNextPages(page + preloadPages - 1)
            .then(newData => {
              preloadedData.push(...newData);
            })
            .catch(error => {
              console.error('Error preloading pages:', error);
            });
        }
      } else {
        // Fallback to direct fetch if preloading failed
        const [moviesResponse, tvResponse] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&page=${page}`),
          fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&page=${page}`)
        ]);
        
        const moviesData = await moviesResponse.json();
        const tvData = await tvResponse.json();
        
        currentPageData = {
          movies: moviesData.results as Movie[],
          tvShows: tvData.results as TVShow[]
        };
      }

      if (currentPageData.movies.length === 0 && currentPageData.tvShows.length === 0) {
        hasMore = false;
        break;
      }

      // Process movies in parallel with controlled concurrency
      const moviePromises = currentPageData.movies.map(async (movie: Movie) => {
        const isAvailable = await checkAndCacheAvailability(movie, 'movie');
        processedCount++;
        console.log(`[${processedCount}] Movie: ${movie.title} - ${isAvailable ? 'Available' : 'Not Available'}`);
        return isAvailable;
      });

      // Process in batches to control concurrency
      for (let i = 0; i < moviePromises.length; i += maxConcurrent) {
        const batch = moviePromises.slice(i, i + maxConcurrent);
        await Promise.all(batch);
      }

      // Process TV shows in parallel with controlled concurrency
      const tvPromises = currentPageData.tvShows.map(async (show: TVShow) => {
        const isAvailable = await checkAndCacheAvailability(show, 'tvshow');
        processedCount++;
        console.log(`[${processedCount}] TV Show: ${show.name} - ${isAvailable ? 'Available' : 'Not Available'}`);
        return isAvailable;
      });

      // Process in batches to control concurrency
      for (let i = 0; i < tvPromises.length; i += maxConcurrent) {
        const batch = tvPromises.slice(i, i + maxConcurrent);
        await Promise.all(batch);
      }

      console.log(`\nCompleted page ${page} - Processed ${processedCount} items so far`);
      console.log(`Preloaded pages: ${preloadedData.length}\n`);
      page++;
    }

    console.log('\nAll content has been fetched and cached successfully!');
    console.log(`Total items processed: ${processedCount}`);
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
    
    // Build the query based on category
    let query: any = { type, available: true };
    
    switch (category) {
      case 'popular':
        // Sort by TMDB popularity score
        query = { ...query, 'data.popularity': { $exists: true } };
        break;
      case 'latest':
        // Sort by release date
        query = { ...query, 'data.release_date': { $exists: true } };
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
        sort = { 'data.release_date': -1 };
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