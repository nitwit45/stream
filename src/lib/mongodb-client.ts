import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load env (matches pattern in src/api/mongodb.ts)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

const uri = process.env.MONGODB_URI;
const options = {};

// Next.js + MongoDB adapter pattern: export a clientPromise.
// In dev, cache on globalThis to survive HMR reloads.
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  const client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
