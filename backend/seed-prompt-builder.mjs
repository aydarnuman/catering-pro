import dotenv from 'dotenv';
dotenv.config();

import { query } from './src/database.js';

async function seedPromptBuilder() {
  console.log('🌱 Prompt Builder seed başlıyor...');

  try {
    // 1. Tabloları oluştur
    await query(`
      CREATE TABLE IF NOT EXISTS pb_categories (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(50) DEFAULT 'blue',
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ pb_categories tablosu oluşturuldu');

    await query(`
      CREATE TABLE IF NOT EXISTS pb_questions (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES pb_categories(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        question_type VARCHAR(50) DEFAULT 'text',
        options JSONB,
        placeholder VARCHAR(255),
        is_required BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        variable_name VARCHAR(100) NOT NULL,
        help_text TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ pb_questions tablosu oluşturuldu');

    await query(`
      CREATE TABLE IF NOT EXISTS pb_templates (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES pb_categories(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        template_text TEXT NOT NULL,
        style_options JSONB,
        model_hint VARCHAR(100),
        example_output TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ pb_templates tablosu oluşturuldu');

    await query(`
      CREATE TABLE IF NOT EXISTS pb_saved_prompts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES pb_categories(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        generated_prompt TEXT NOT NULL,
        answers JSONB,
        style VARCHAR(50),
        is_favorite BOOLEAN DEFAULT FALSE,
        is_public BOOLEAN DEFAULT FALSE,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ pb_saved_prompts tablosu oluşturuldu');

    // 2. Kategorileri ekle
    const categories = [
      { slug: 'ihale', name: 'İhale Analizi', description: 'İhale değerlendirme, risk analizi ve strateji geliştirme', icon: '📋', color: 'violet', sort_order: 1 },
      { slug: 'muhasebe', name: 'Muhasebe & Finans', description: 'Mali analiz, raporlama ve finansal planlama', icon: '💰', color: 'green', sort_order: 2 },
      { slug: 'personel', name: 'İK & Personel', description: 'Çalışan yönetimi, bordro ve izin işlemleri', icon: '👥', color: 'blue', sort_order: 3 },
      { slug: 'operasyon', name: 'Operasyon & Stok', description: 'Depo yönetimi, üretim planlama ve tedarik', icon: '📦', color: 'orange', sort_order: 4 },
      { slug: 'strateji', name: 'Strateji & Planlama', description: 'İş geliştirme, pazar analizi ve hedef belirleme', icon: '🎯', color: 'cyan', sort_order: 5 },
      { slug: 'yazisma', name: 'Resmi Yazışma', description: 'Dilekçe, teklif mektubu ve resmi belgeler', icon: '📝', color: 'gray', sort_order: 6 },
      { slug: 'serbest', name: 'Serbest Prompt', description: 'Kategorisiz, tamamen özelleştirilebilir prompt', icon: '✨', color: 'grape', sort_order: 0 },
    ];

    for (const cat of categories) {
      await query(`
        INSERT INTO pb_categories (slug, name, description, icon, color, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          icon = EXCLUDED.icon,
          color = EXCLUDED.color,
          sort_order = EXCLUDED.sort_order,
          updated_at = CURRENT_TIMESTAMP
      `, [cat.slug, cat.name, cat.description, cat.icon, cat.color, cat.sort_order]);
    }
    console.log('✅ Kategoriler eklendi');

    // 3. İhale kategorisi soruları
    const ihaleId = (await query(`SELECT id FROM pb_categories WHERE slug = 'ihale'`)).rows[0]?.id;
    if (ihaleId) {
      const ihaleQuestions = [
        { text: 'Hangi sektördeki ihaleyi analiz ediyorsunuz?', type: 'select', var: 'sektor', order: 1, options: [
          { label: 'Catering / Yemek', value: 'catering' },
          { label: 'İnşaat', value: 'insaat' },
          { label: 'Teknoloji / IT', value: 'teknoloji' },
          { label: 'Sağlık', value: 'saglik' },
          { label: 'Eğitim', value: 'egitim' },
          { label: 'Diğer', value: 'diger' }
        ], help: 'İhalenin ait olduğu sektörü seçin' },
        { text: 'İhale konusu nedir?', type: 'textarea', var: 'konu', order: 2, options: null, help: 'İhalenin ana konusunu kısaca açıklayın' },
        { text: 'Tahmini bütçe ne kadar? (TL)', type: 'number', var: 'butce', order: 3, options: null, help: 'Yaklaşık ihale bütçesini girin' },
        { text: 'Başvuru için kalan süre?', type: 'select', var: 'sure', order: 4, options: [
          { label: '1 haftadan az', value: '1_hafta_az' },
          { label: '1-2 hafta', value: '1_2_hafta' },
          { label: '2 haftadan fazla', value: '2_hafta_fazla' }
        ], help: 'Son başvuru tarihine kalan süre' },
        { text: 'Özellikle dikkat edilmesi gereken konular?', type: 'textarea', var: 'dikkat_konulari', order: 5, options: null, help: 'Örn: Geçici teminat, ISO belgeleri, referanslar' },
      ];

      for (const q of ihaleQuestions) {
        await query(`
          INSERT INTO pb_questions (category_id, question_text, question_type, variable_name, sort_order, options, help_text)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [ihaleId, q.text, q.type, q.var, q.order, q.options ? JSON.stringify(q.options) : null, q.help]);
      }

      // İhale şablonu
      await query(`
        INSERT INTO pb_templates (category_id, name, template_text, style_options, model_hint)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        ihaleId,
        'İhale Analiz Raporu',
        `Sen deneyimli bir ihale uzmanısın. {{sektor}} sektöründe bir ihale analiz edeceksin.

İhale Konusu: {{konu}}
Tahmini Bütçe: {{butce}} TL
Başvuru Süresi: {{sure}}
Dikkat Edilmesi Gerekenler: {{dikkat_konulari}}

Lütfen şu başlıklar altında detaylı analiz yap:
1. 🎯 Risk Değerlendirmesi
2. 📊 Rekabet Analizi
3. 💰 Fiyatlandırma Stratejisi
4. ⚖️ Hukuki Dikkat Noktaları
5. ✅ Önerilen Aksiyon Planı`,
        JSON.stringify(['professional', 'technical']),
        'claude'
      ]);
      console.log('✅ İhale soruları ve şablonu eklendi');
    }

    // 4. Serbest kategori için basit şablon
    const serbestId = (await query(`SELECT id FROM pb_categories WHERE slug = 'serbest'`)).rows[0]?.id;
    if (serbestId) {
      await query(`
        INSERT INTO pb_questions (category_id, question_text, question_type, variable_name, sort_order, help_text)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
      `, [serbestId, 'Prompt\'unuzu buraya yazın', 'textarea', 'serbest_prompt', 1, 'AI\'a vermek istediğiniz komutu veya soruyu yazın']);

      await query(`
        INSERT INTO pb_templates (category_id, name, template_text, style_options, model_hint)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [serbestId, 'Serbest Prompt', '{{serbest_prompt}}', JSON.stringify(['professional', 'friendly', 'creative', 'technical']), 'claude']);
      console.log('✅ Serbest kategori eklendi');
    }

    // 5. Muhasebe kategorisi
    const muhasebeId = (await query(`SELECT id FROM pb_categories WHERE slug = 'muhasebe'`)).rows[0]?.id;
    if (muhasebeId) {
      const muhasebeQuestions = [
        { text: 'Hangi dönemi analiz ediyorsunuz?', type: 'select', var: 'donem', order: 1, options: [
          { label: 'Bu Ay', value: 'bu_ay' },
          { label: 'Geçen Ay', value: 'gecen_ay' },
          { label: 'Bu Yıl', value: 'bu_yil' },
          { label: 'Geçen Yıl', value: 'gecen_yil' }
        ], help: 'Analiz edilecek dönemi seçin' },
        { text: 'Hangi tür raporu istiyorsunuz?', type: 'select', var: 'rapor_turu', order: 2, options: [
          { label: 'Gelir-Gider Raporu', value: 'gelir_gider' },
          { label: 'Nakit Akış Analizi', value: 'nakit_akis' },
          { label: 'Bilanço Özeti', value: 'bilanco' },
          { label: 'Karlılık Analizi', value: 'karlilik' }
        ], help: 'Oluşturulacak rapor türünü seçin' },
        { text: 'Ek bilgi veya özel istekleriniz?', type: 'textarea', var: 'ek_bilgi', order: 3, options: null, help: 'Örn: Enflasyon etkisi, sektör karşılaştırması' },
      ];

      for (const q of muhasebeQuestions) {
        await query(`
          INSERT INTO pb_questions (category_id, question_text, question_type, variable_name, sort_order, options, help_text)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [muhasebeId, q.text, q.type, q.var, q.order, q.options ? JSON.stringify(q.options) : null, q.help]);
      }

      await query(`
        INSERT INTO pb_templates (category_id, name, template_text, style_options, model_hint)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        muhasebeId,
        'Finansal Analiz Raporu',
        `Sen deneyimli bir mali müşavirsin. {{donem}} dönemi için {{rapor_turu}} hazırlayacaksın.

Ek Talepler: {{ek_bilgi}}

Lütfen şu başlıklar altında detaylı analiz yap:
1. 📈 Dönem Özeti
2. 💹 Temel Finansal Göstergeler
3. ⚠️ Dikkat Edilmesi Gereken Noktalar
4. 💡 İyileştirme Önerileri`,
        JSON.stringify(['professional', 'technical']),
        'claude'
      ]);
      console.log('✅ Muhasebe soruları ve şablonu eklendi');
    }

    console.log('\n🎉 Seed işlemi tamamlandı!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

seedPromptBuilder();
