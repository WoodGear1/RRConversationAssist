import { createPool } from './index';

async function testConnection() {
  const pool = createPool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rrconversationassist',
  });

  try {
    // Test basic connection
    const result = await pool.query('SELECT NOW() as now, version() as version');
    console.log('✅ Database connection successful');
    console.log('Time:', result.rows[0].now);
    console.log('PostgreSQL version:', result.rows[0].version);

    // Test pgvector extension
    const vectorResult = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as pgvector_enabled;
    `);
    console.log('pgvector enabled:', vectorResult.rows[0].pgvector_enabled);

    // Test vector operations
    if (vectorResult.rows[0].pgvector_enabled) {
      const testVector = await pool.query(`
        SELECT '[1,2,3]'::vector as test_vector;
      `);
      console.log('✅ Vector type works:', testVector.rows[0].test_vector);
    }

    // Test search_chunks table and vector search
    const chunksResult = await pool.query(`
      SELECT COUNT(*) as count FROM search_chunks;
    `);
    console.log('search_chunks count:', chunksResult.rows[0].count);

    if (parseInt(chunksResult.rows[0].count) > 0) {
      // Test vector similarity search
      const searchResult = await pool.query(`
        SELECT id, recording_id, start_ms, end_ms, 
               embedding <-> '[0.1,0.2,0.3]'::vector as distance
        FROM search_chunks
        ORDER BY embedding <-> '[0.1,0.2,0.3]'::vector
        LIMIT 5;
      `);
      console.log('✅ Vector similarity search works');
      console.log('Sample results:', searchResult.rows);
    }

    // Test full-text search
    const fulltextResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM search_chunks 
      WHERE text_vector @@ to_tsquery('russian', 'тест');
    `);
    console.log('✅ Full-text search works');
    console.log('Full-text search results:', fulltextResult.rows[0].count);

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();
