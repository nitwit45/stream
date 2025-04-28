import { fetchAndCacheAllContent } from '../src/api/mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from both .env and .env.local
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Verify MongoDB URI is set
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set in either .env or .env.local');
  process.exit(1);
}

async function fetchAllContent() {
  try {
    console.log('Starting to fetch all available content...');
    await fetchAndCacheAllContent();
    console.log('All content has been fetched and cached successfully!');
  } catch (error) {
    console.error('Error fetching all content:', error);
    process.exit(1);
  }
}

fetchAllContent(); 