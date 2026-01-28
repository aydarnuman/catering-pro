-- =====================================================
-- AI PROMPT BUILDER MODÜLÜ
-- Adım adım interaktif prompt oluşturma sistemi
-- =====================================================

-- 1. PROMPT BUILDER KATEGORİLERİ
CREATE TABLE IF NOT EXISTS pb_categories (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT '📝',
  color VARCHAR(50) DEFAULT 'blue',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. DİNAMİK SORULAR
CREATE TABLE IF NOT EXISTS pb_questions (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES pb_categories(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(50) DEFAULT 'text', -- text, select, multiselect, textarea, number
  options JSONB, -- Select seçenekleri için [{value: '', label: ''}]
  placeholder VARCHAR(255),
  is_required BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  variable_name VARCHAR(100) NOT NULL, -- Prompt'ta kullanılacak {{degisken}}
  help_text TEXT,
  default_value TEXT,
  validation_rules JSONB, -- {min: 0, max: 100, pattern: '...'} gibi
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PROMPT ŞABLONLARI (Builder için)
CREATE TABLE IF NOT EXISTS pb_templates (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES pb_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  template_text TEXT NOT NULL, -- {{degisken}} placeholder'lı metin
  style VARCHAR(50) DEFAULT 'professional', -- professional, friendly, technical, creative
  model_hint VARCHAR(100), -- claude, gpt, gemini için öneriler
  example_output TEXT, -- Örnek çıktı
  is_active BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE, -- Kategori için varsayılan
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. KULLANICI KAYDEDİLMİŞ PROMPT'LARI
CREATE TABLE IF NOT EXISTS pb_saved_prompts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES pb_categories(id) ON DELETE SET NULL,
  template_id INTEGER REFERENCES pb_templates(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  generated_prompt TEXT NOT NULL,
  answers JSONB NOT NULL, -- Kullanıcının verdiği cevaplar {variable_name: value}
  style VARCHAR(50),
  is_favorite BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE, -- Takımla paylaşım
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. KULLANIM İSTATİSTİKLERİ
CREATE TABLE IF NOT EXISTS pb_usage_stats (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  saved_prompt_id INTEGER REFERENCES pb_saved_prompts(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES pb_categories(id) ON DELETE SET NULL,
  template_id INTEGER REFERENCES pb_templates(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- generate, copy, use_in_chat, share, edit
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_pb_categories_active ON pb_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_pb_categories_sort ON pb_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_pb_questions_category ON pb_questions(category_id);
CREATE INDEX IF NOT EXISTS idx_pb_questions_sort ON pb_questions(sort_order);
CREATE INDEX IF NOT EXISTS idx_pb_templates_category ON pb_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_pb_templates_style ON pb_templates(style);
CREATE INDEX IF NOT EXISTS idx_pb_saved_user ON pb_saved_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_pb_saved_public ON pb_saved_prompts(is_public);
CREATE INDEX IF NOT EXISTS idx_pb_saved_favorite ON pb_saved_prompts(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_pb_stats_user ON pb_usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_pb_stats_action ON pb_usage_stats(action);

-- Trigger: updated_at otomatik güncelleme
CREATE OR REPLACE FUNCTION update_pb_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pb_categories_update ON pb_categories;
CREATE TRIGGER pb_categories_update
  BEFORE UPDATE ON pb_categories
  FOR EACH ROW EXECUTE FUNCTION update_pb_timestamp();

DROP TRIGGER IF EXISTS pb_templates_update ON pb_templates;
CREATE TRIGGER pb_templates_update
  BEFORE UPDATE ON pb_templates
  FOR EACH ROW EXECUTE FUNCTION update_pb_timestamp();

DROP TRIGGER IF EXISTS pb_saved_update ON pb_saved_prompts;
CREATE TRIGGER pb_saved_update
  BEFORE UPDATE ON pb_saved_prompts
  FOR EACH ROW EXECUTE FUNCTION update_pb_timestamp();

-- =====================================================
-- SEED DATA
-- =====================================================

-- Kategoriler
INSERT INTO pb_categories (slug, name, description, icon, color, sort_order) VALUES
('ihale', 'İhale Analizi', 'İhale değerlendirme, teklif hazırlama ve strateji', '📋', 'violet', 1),
('muhasebe', 'Muhasebe & Finans', 'Mali analiz, raporlama ve bütçe yönetimi', '💰', 'green', 2),
('personel', 'İK & Personel', 'Çalışan yönetimi, bordro ve performans', '👥', 'blue', 3),
('operasyon', 'Operasyon & Stok', 'Depo yönetimi, üretim ve lojistik', '📦', 'orange', 4),
('strateji', 'Strateji & Planlama', 'İş geliştirme, hedef belirleme ve analiz', '🎯', 'cyan', 5),
('yazisma', 'Resmi Yazışma', 'Dilekçe, sözleşme ve resmi belgeler', '📝', 'gray', 6),
('musteri', 'Müşteri İlişkileri', 'Teklif, sözleşme ve müşteri iletişimi', '🤝', 'pink', 7),
('rapor', 'Rapor & Sunum', 'Raporlama, analiz sunumu ve dashboard', '📊', 'indigo', 8)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order;

-- İhale Kategorisi Soruları
INSERT INTO pb_questions (category_id, question_text, question_type, variable_name, options, placeholder, sort_order, help_text) VALUES
(
  (SELECT id FROM pb_categories WHERE slug = 'ihale'),
  'Hangi sektördeki ihaleyi analiz ediyorsunuz?',
  'select',
  'sektor',
  '[{"value": "yemek", "label": "Yemek/Catering"}, {"value": "temizlik", "label": "Temizlik"}, {"value": "guvenlik", "label": "Güvenlik"}, {"value": "insaat", "label": "İnşaat"}, {"value": "bilisim", "label": "Bilişim/IT"}, {"value": "diger", "label": "Diğer"}]',
  'Sektör seçin',
  1,
  'İhalenin ait olduğu ana sektörü seçin'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'ihale'),
  'İhalenin tahmini bütçesi ne kadar?',
  'text',
  'butce',
  NULL,
  'Örn: 5.000.000 TL',
  2,
  'Yaklaşık bütçeyi TL cinsinden yazın'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'ihale'),
  'Başvuru için kalan süre?',
  'select',
  'sure',
  '[{"value": "1-3", "label": "1-3 gün"}, {"value": "4-7", "label": "4-7 gün"}, {"value": "1-2hafta", "label": "1-2 hafta"}, {"value": "2hafta+", "label": "2 haftadan fazla"}]',
  'Süre seçin',
  3,
  'Son başvuru tarihine kalan süre'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'ihale'),
  'İhale kurumu hangisi?',
  'select',
  'kurum',
  '[{"value": "kamu", "label": "Kamu Kurumu"}, {"value": "belediye", "label": "Belediye"}, {"value": "universite", "label": "Üniversite"}, {"value": "hastane", "label": "Hastane"}, {"value": "kyk", "label": "KYK"}, {"value": "ozel", "label": "Özel Sektör"}]',
  'Kurum türü seçin',
  4,
  'İhaleyi açan kurum türü'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'ihale'),
  'Özellikle dikkat edilmesi gereken konular neler?',
  'textarea',
  'dikkat_konulari',
  NULL,
  'Örn: ISO belgeleri, geçici teminat oranı, iş deneyimi...',
  5,
  'Şartnamede öne çıkan veya dikkat edilmesi gereken özel şartları yazın'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'ihale'),
  'Firmanızın bu alandaki deneyimi?',
  'select',
  'deneyim',
  '[{"value": "yeni", "label": "İlk ihale"}, {"value": "1-5", "label": "1-5 ihale"}, {"value": "5-10", "label": "5-10 ihale"}, {"value": "10+", "label": "10+ ihale"}]',
  'Deneyim seviyesi',
  6,
  'Benzer ihalelerdeki deneyiminiz'
);

-- Muhasebe Kategorisi Soruları
INSERT INTO pb_questions (category_id, question_text, question_type, variable_name, options, placeholder, sort_order, help_text) VALUES
(
  (SELECT id FROM pb_categories WHERE slug = 'muhasebe'),
  'Ne tür bir finansal analiz istiyorsunuz?',
  'select',
  'analiz_turu',
  '[{"value": "nakit", "label": "Nakit Akış Analizi"}, {"value": "karlilik", "label": "Karlılık Analizi"}, {"value": "maliyet", "label": "Maliyet Analizi"}, {"value": "butce", "label": "Bütçe Karşılaştırması"}, {"value": "risk", "label": "Finansal Risk Analizi"}]',
  'Analiz türü seçin',
  1,
  'Yapılmasını istediğiniz analiz türü'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'muhasebe'),
  'Hangi dönem için analiz yapılacak?',
  'select',
  'donem',
  '[{"value": "aylik", "label": "Aylık"}, {"value": "ceyreklik", "label": "Çeyreklik"}, {"value": "yillik", "label": "Yıllık"}, {"value": "karsilastirmali", "label": "Dönem Karşılaştırmalı"}]',
  'Dönem seçin',
  2,
  'Analiz yapılacak zaman dilimi'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'muhasebe'),
  'Özel olarak incelenmesi gereken kalemler var mı?',
  'textarea',
  'ozel_kalemler',
  NULL,
  'Örn: Personel giderleri, hammadde maliyetleri, kira giderleri...',
  3,
  'Detaylı incelenmesini istediğiniz hesap kalemleri'
);

-- Personel Kategorisi Soruları
INSERT INTO pb_questions (category_id, question_text, question_type, variable_name, options, placeholder, sort_order, help_text) VALUES
(
  (SELECT id FROM pb_categories WHERE slug = 'personel'),
  'Ne tür bir İK işlemi yapılacak?',
  'select',
  'islem_turu',
  '[{"value": "bordro", "label": "Bordro Hesaplama"}, {"value": "izin", "label": "İzin Yönetimi"}, {"value": "kidem", "label": "Kıdem/İhbar Hesaplama"}, {"value": "performans", "label": "Performans Değerlendirme"}, {"value": "ise_alim", "label": "İşe Alım"}]',
  'İşlem türü seçin',
  1,
  'Yapılacak İK işleminin türü'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'personel'),
  'Personel sayısı kaç?',
  'select',
  'personel_sayisi',
  '[{"value": "1-10", "label": "1-10 kişi"}, {"value": "11-50", "label": "11-50 kişi"}, {"value": "51-100", "label": "51-100 kişi"}, {"value": "100+", "label": "100+ kişi"}]',
  'Personel sayısı',
  2,
  'İşlemin kapsayacağı personel sayısı'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'personel'),
  'Özel durumlar veya notlar?',
  'textarea',
  'ozel_notlar',
  NULL,
  'Örn: Engelli personel, stajyer, yarı zamanlı çalışan...',
  3,
  'Dikkat edilmesi gereken özel durumlar'
);

-- Strateji Kategorisi Soruları
INSERT INTO pb_questions (category_id, question_text, question_type, variable_name, options, placeholder, sort_order, help_text) VALUES
(
  (SELECT id FROM pb_categories WHERE slug = 'strateji'),
  'Hangi konuda strateji geliştirmek istiyorsunuz?',
  'select',
  'strateji_konusu',
  '[{"value": "buyume", "label": "Büyüme Stratejisi"}, {"value": "pazar", "label": "Pazar Analizi"}, {"value": "rakip", "label": "Rakip Analizi"}, {"value": "swot", "label": "SWOT Analizi"}, {"value": "yatirim", "label": "Yatırım Kararı"}]',
  'Strateji konusu',
  1,
  'Analiz veya strateji konusu'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'strateji'),
  'Hedef zaman dilimi?',
  'select',
  'zaman_dilimi',
  '[{"value": "kisa", "label": "Kısa vadeli (3 ay)"}, {"value": "orta", "label": "Orta vadeli (1 yıl)"}, {"value": "uzun", "label": "Uzun vadeli (3+ yıl)"}]',
  'Zaman dilimi',
  2,
  'Stratejinin hedeflediği süre'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'strateji'),
  'Mevcut durum ve hedeflerinizi kısaca açıklayın',
  'textarea',
  'mevcut_durum',
  NULL,
  'Mevcut durumunuz, hedefleriniz, zorluklar...',
  3,
  'Stratejinin bağlamını anlamak için önemli'
);

-- Yazışma Kategorisi Soruları
INSERT INTO pb_questions (category_id, question_text, question_type, variable_name, options, placeholder, sort_order, help_text) VALUES
(
  (SELECT id FROM pb_categories WHERE slug = 'yazisma'),
  'Ne tür bir belge hazırlanacak?',
  'select',
  'belge_turu',
  '[{"value": "dilekce", "label": "Dilekçe"}, {"value": "sozlesme", "label": "Sözleşme"}, {"value": "teklif", "label": "Teklif Mektubu"}, {"value": "bildirim", "label": "Resmi Bildirim"}, {"value": "itiraz", "label": "İtiraz Dilekçesi"}]',
  'Belge türü seçin',
  1,
  'Hazırlanacak resmi belgenin türü'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'yazisma'),
  'Muhatap kim olacak?',
  'select',
  'muhatap',
  '[{"value": "kamu", "label": "Kamu Kurumu"}, {"value": "ozel", "label": "Özel Şirket"}, {"value": "mahkeme", "label": "Mahkeme/Hukuki"}, {"value": "diger", "label": "Diğer"}]',
  'Muhatap türü',
  2,
  'Belgenin gönderileceği kurum/kişi türü'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'yazisma'),
  'Konuyu ve detayları açıklayın',
  'textarea',
  'konu_detay',
  NULL,
  'Belgenin konusu, istenen/talep edilen şey, önemli detaylar...',
  3,
  'Belgenin içeriği için gerekli bilgiler'
);

-- İhale Kategorisi Şablonları
INSERT INTO pb_templates (category_id, name, template_text, style, model_hint, is_default, example_output) VALUES
(
  (SELECT id FROM pb_categories WHERE slug = 'ihale'),
  'İhale Risk Analizi',
  'Sen deneyimli bir ihale danışmanısın. {{sektor}} sektöründe faaliyet gösteren bir firma için {{butce}} bütçeli bir ihaleyi analiz edeceksin.

**İhale Bilgileri:**
- Sektör: {{sektor}}
- Tahmini Bütçe: {{butce}}
- Kalan Süre: {{sure}}
- Kurum Türü: {{kurum}}
- Dikkat Edilecek Konular: {{dikkat_konulari}}
- Firma Deneyimi: {{deneyim}}

Lütfen şu başlıklar altında detaylı analiz yap:

1. **Risk Değerlendirmesi**
   - Teknik riskler
   - Mali riskler
   - Hukuki riskler
   - Operasyonel riskler

2. **Fırsat Analizi**
   - Güçlü yönler
   - Rekabet avantajları
   - Başarı faktörleri

3. **Teklif Stratejisi**
   - Önerilen fiyatlandırma yaklaşımı
   - Dikkat edilmesi gereken şartname maddeleri
   - Hazırlanması gereken belgeler

4. **Sonuç ve Öneriler**
   - Katılım tavsiyesi (Katıl/Katılma)
   - Kritik başarı faktörleri
   - Aksiyon planı

Türkçe ve profesyonel bir dille yaz. Sayıları formatla (1.000.000 TL şeklinde).',
  'professional',
  'claude',
  TRUE,
  'İhale risk analizi örneği buraya gelecek...'
),
(
  (SELECT id FROM pb_categories WHERE slug = 'ihale'),
  'Teklif Fiyatı Analizi',
  'Sen bir maliyet analisti ve ihale uzmanısın. {{sektor}} sektöründe {{butce}} bütçeli bir ihale için optimal teklif fiyatı belirleyeceksin.

**Veriler:**
- Sektör: {{sektor}}
- Tahmini Bütçe: {{butce}}
- Kurum: {{kurum}}
- Özel Koşullar: {{dikkat_konulari}}

Şunları analiz et:
1. Piyasa fiyat analizi
2. Maliyet hesaplaması
3. Kar marjı önerileri
4. Rekabetçi fiyat aralığı
5. Risk payı hesabı

Sonuç olarak minimum, optimal ve maksimum teklif fiyatı öner.',
  'technical',
  'claude',
  FALSE,
  NULL
);

-- Muhasebe Kategorisi Şablonları
INSERT INTO pb_templates (category_id, name, template_text, style, model_hint, is_default) VALUES
(
  (SELECT id FROM pb_categories WHERE slug = 'muhasebe'),
  'Finansal Analiz Raporu',
  'Sen deneyimli bir CFO ve mali müşavirsin. Aşağıdaki parametrelere göre detaylı finansal analiz yap:

**Analiz Parametreleri:**
- Analiz Türü: {{analiz_turu}}
- Dönem: {{donem}}
- Özel İnceleme Kalemleri: {{ozel_kalemler}}

Lütfen şu başlıklar altında profesyonel bir rapor hazırla:

1. **Özet Bulgular**
   - Ana finansal göstergeler
   - Dikkat çeken trendler
   - Kritik uyarılar

2. **Detaylı Analiz**
   - {{analiz_turu}} için spesifik metrikler
   - Dönemsel karşılaştırma
   - Sektör karşılaştırması (varsa)

3. **Risk ve Fırsatlar**
   - Finansal riskler
   - İyileştirme fırsatları
   - Nakit akış önerileri

4. **Öneriler**
   - Kısa vadeli aksiyonlar
   - Orta/uzun vadeli stratejiler
   - KPI hedefleri

Tüm rakamları formatla, grafik önerileri yap, Türkçe ve profesyonel dil kullan.',
  'professional',
  'claude',
  TRUE
);

-- Personel Kategorisi Şablonları
INSERT INTO pb_templates (category_id, name, template_text, style, model_hint, is_default) VALUES
(
  (SELECT id FROM pb_categories WHERE slug = 'personel'),
  'İK Analiz ve Öneri',
  'Sen deneyimli bir İK yöneticisisin. Aşağıdaki parametrelere göre İK analizi yap:

**Parametreler:**
- İşlem Türü: {{islem_turu}}
- Personel Sayısı: {{personel_sayisi}}
- Özel Notlar: {{ozel_notlar}}

{{islem_turu}} için:
1. Mevcut durum analizi
2. Yasal gereklilikler
3. Hesaplama detayları (varsa)
4. Öneriler ve iyileştirmeler
5. Dikkat edilmesi gerekenler

Türkçe, profesyonel ve SGK/İş Kanunu uyumlu bilgiler ver.',
  'professional',
  'claude',
  TRUE
);

-- Strateji Kategorisi Şablonları
INSERT INTO pb_templates (category_id, name, template_text, style, model_hint, is_default) VALUES
(
  (SELECT id FROM pb_categories WHERE slug = 'strateji'),
  'Stratejik Analiz',
  'Sen deneyimli bir strateji danışmanısın. Aşağıdaki bilgilere göre kapsamlı bir stratejik analiz yap:

**Analiz Bilgileri:**
- Strateji Konusu: {{strateji_konusu}}
- Zaman Dilimi: {{zaman_dilimi}}
- Mevcut Durum: {{mevcut_durum}}

Şu başlıklarda detaylı analiz yap:

1. **Durum Analizi**
   - Mevcut pozisyon
   - Güçlü/zayıf yönler
   - Fırsat/tehditler

2. **{{strateji_konusu}} Analizi**
   - Detaylı inceleme
   - Veri ve bulgular
   - Karşılaştırmalı değerlendirme

3. **Stratejik Öneriler**
   - {{zaman_dilimi}} için hedefler
   - Aksiyon planı
   - Kaynak gereksinimleri
   - Başarı kriterleri

4. **Risk ve Kontrol**
   - Olası riskler
   - Azaltma stratejileri
   - İzleme metrikleri

Profesyonel, veri odaklı ve uygulanabilir öneriler sun.',
  'professional',
  'claude',
  TRUE
);

-- Yazışma Kategorisi Şablonları  
INSERT INTO pb_templates (category_id, name, template_text, style, model_hint, is_default) VALUES
(
  (SELECT id FROM pb_categories WHERE slug = 'yazisma'),
  'Resmi Belge Hazırlama',
  'Sen deneyimli bir hukuk danışmanı ve yazışma uzmanısın. Aşağıdaki bilgilere göre profesyonel bir {{belge_turu}} hazırla:

**Belge Bilgileri:**
- Belge Türü: {{belge_turu}}
- Muhatap: {{muhatap}}
- Konu ve Detaylar: {{konu_detay}}

Lütfen:
1. Resmi yazışma formatına uygun
2. Hukuki açıdan doğru
3. Net ve anlaşılır
4. Profesyonel dil
5. Tarih/protokol numarası için yer bırak

şeklinde bir {{belge_turu}} taslağı hazırla.

Gerekiyorsa alternatif ifadeler veya ek maddeler öner.',
  'professional',
  'claude',
  TRUE
);

COMMIT;
