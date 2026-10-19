import { Pool } from '@neondatabase/serverless'
import 'dotenv/config'

async function test() {
  console.log('Testing Neon Serverless connection (Port 443/WebSocket)...')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  
  try {
    const client = await pool.connect()
    console.log('✅ Connected successfully via Serverless Driver!')
    const res = await client.query('SELECT 1 as connected')
    console.log('✅ Query result:', res.rows[0])
    client.release()
  } catch (err) {
    console.error('❌ Serverless connection failed:', err)
  } finally {
    await pool.end()
  }
}

test()
