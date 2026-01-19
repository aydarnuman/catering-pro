import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false
});

async function updateModels() {
  const client = await pool.connect();
  try {
    // Genel Asistan ve Hızlı Cevap hariç tümünü Opus yap
    const result = await client.query(`
      UPDATE ai_prompt_templates 
      SET preferred_model = 'claude-opus-4-20250514', updated_at = CURRENT_TIMESTAMP
      WHERE slug NOT IN ('default', 'hizli-yanit')
    `);
    console.log('Güncellenen satır:', result.rowCount);
    
    // Kontrol
    const check = await client.query('SELECT name, preferred_model FROM ai_prompt_templates ORDER BY name');
    console.log('\nGüncel Durum:');
    check.rows.forEach(r => {
      const model = r.preferred_model 
        ? (r.preferred_model.includes('opus') ? '🧠 Opus' : '⚡ Sonnet') 
        : '⚡ Sonnet (varsayılan)';
      console.log(`  ${r.name}: ${model}`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

updateModels().catch(console.error);
