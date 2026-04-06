import { connectToDatabase } from '../src/api/mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set in either .env or .env.local');
  process.exit(1);
}

// Prune docs whose `lastChecked` is older than the given threshold.
// Default: 30 days. Override via CLI arg (days), e.g. `npm run cleanup -- 60`.
async function cleanup() {
  const days = Number(process.argv[2] ?? 30);
  if (!Number.isFinite(days) || days <= 0) {
    console.error(`Invalid days arg: ${process.argv[2]}`);
    process.exit(1);
  }

  const { contentCollection } = await connectToDatabase();
  if (!contentCollection) throw new Error('content collection unavailable');

  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);

  const staleCount = await contentCollection.countDocuments({ lastChecked: { $lt: threshold } });
  const totalCount = await contentCollection.countDocuments();

  console.log(`Threshold: lastChecked < ${threshold.toISOString()} (${days} days ago)`);
  console.log(`Would delete ${staleCount} of ${totalCount} docs.`);

  if (process.argv.includes('--apply')) {
    const result = await contentCollection.deleteMany({ lastChecked: { $lt: threshold } });
    console.log(`Deleted ${result.deletedCount} docs.`);
  } else {
    console.log('Dry run. Re-run with --apply to delete.');
    console.log(`  e.g. npm run cleanup -- ${days} --apply`);
  }
  process.exit(0);
}

cleanup().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
