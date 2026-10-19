import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env from apps/web
dotenv.config({ path: resolve(process.cwd(), '.env') });

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("❌ DATABASE_URL is not set in .env");
  process.exit(1);
}

const dbUrl = url;

async function test() {
  console.log('🚀 [Direct Test] Testing Neon HTTP connectivity...');
  console.log("📍 [Direct Test] Connection string prefix:", dbUrl.substring(0, 20) + "...");
  
  const sql = neon(dbUrl);
  
  try {
    const result = await sql`SELECT NOW() as now, version() as version`;
    console.log('✅ [Direct Test] SUCCESS!');
    console.log('📅 [Direct Test] DB Time:', result[0].now);
    console.log('ℹ️ [Direct Test] PG Version:', result[0].version);
    
    // Test if we can query the User table (if it exists)
    try {
      const users = await sql`SELECT count(*) as count FROM "user"`;
      console.log('👥 [Direct Test] User count:', users[0].count);
    } catch (e) {
      console.log('⚠️ [Direct Test] User table might not exist yet:', (e as Error).message);
    }
    
  } catch (error) {
    console.error('❌ [Direct Test] FAILED:', error);
    process.exit(1);
  }
}

test();
