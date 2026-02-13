# Azure Model Eğitimi & Training Pipeline Dokümantasyonu

> Son güncelleme: 2026-02-13 (kaynak: azure-training-analysis.mdc doğrulanarak taşındı)

## Genel Bakış

Azure Document Intelligence Custom Model ile ihale dokümanlarından otomatik veri çıkarma. Neural model eğitimi, smart-label ile yarı-otomatik etiketleme.

## Training Pipeline (6 Aşama)

1. **Veri Toplama**: fetch-training-docs.mjs, fetch-diverse-training.mjs (Supabase DB + ihalebul.com)
2. **Depolama**: download-from-storage.mjs, download-from-tenders.mjs (PDF indirme)
3. **Hazırlık**: prepare-training-data.mjs, setup-query-fields.mjs (fields.json, manifest)
4. **Etiketleme**: auto-label (keyword), smart-label v1-v5 (Azure Layout + Claude hybrid)
5. **Eğitim**: train-model.mjs (Azure SDK beginBuildDocumentModel, neural model)
6. **Deploy**: .env'e model ID ekle (manuel)

## Smart-Label Evrim (v1→v5)
- v1-v3: Single-pass yaklaşımlar (giderek daha detaylı promptlar)
- v4: Multi-step pipeline (Yapı→Tablo→String→Doğrulama)
- v5 (~961 sat): Enhanced table extraction + alt-alan etiketleri + doğrulama skoru (0-100)

## Label Kataloğu (v5)

### Kritik Tablolar
- ogun_dagilimi: Öğün dağılım tablosu (7 alt-alan)
- personel_tablosu: Personel gereksinimleri (10 alt-alan)

### Önemli Tablolar
- ogun_detay, haftalik_menu, gramaj_tablosu, personel_nitelikleri

### Kritik String Alanları
- ihale_konusu, ihale_kayit_no, idare_adi, gunluk_toplam_ogun
- toplam_personel, sozlesme_suresi, hizmet_gun_sayisi, iscilik_orani

## Eğitim Verisi
- 10 doküman etiketlenmiş (auto-label-v2 çıktısı)
- Kurumlar: Hastane (3), Emniyet (2), Cezaevi (1), Spor (1), Polisevi (1)
- Hedef: 20+ doküman (ideal), mevcut denge yetersiz

## Model Bilgisi
- Azure SDK: @azure/ai-form-recognizer
- Neural model, eğitim süresi ~1-2 saat
- Aktif model: **ihale-catering-v5** (env üzerinden set)
- Kod default fallback: ihale-catering-v1

## AI Veritabanı Tabloları

### Temel Tablolar
- ai_conversations: session_id, user_id, role, content, tools_used
- ai_memory: memory_type, category, key, value, importance, usage_count
- ai_feedback: conversation_id, rating (1-5), model_used, response_time_ms
- ai_prompt_templates: slug, prompt, category, preferred_model (11 template)
- ai_settings: setting_key/value (default_model, learning_threshold vb.)
- ai_learned_facts: fact_type, confidence, verified, source_conversation_id
- ai_reminders: remind_at, repeat_type, status

### GOD Mode Tabloları
- ai_god_mode_logs: tool_name, parameters, result, execution_time_ms
- ai_custom_tools: name, description, parameters, implementation
- ai_secrets: name, encrypted_value, service

### Prompt Builder Tabloları
- pb_categories → pb_questions → pb_templates → pb_saved_prompts → pb_usage_stats

## Maliyet Analizi

### Training (Tek Seferlik): ~$55-110
- Custom Neural Model: ~$50-100
- Azure Layout (500 sayfa): ~$0.75
- Claude API (40 çağrı): ~$2-5

### Inference (Aylık - 100 ihale x 50 sayfa): ~$87-117
- Prebuilt Layout: $7.50
- Custom Model: $50
- Claude API: ~$30-60

## İyileştirme Önerileri
1. **P0:** Eğitim verisi artır (10 → 20+)
2. **P0:** Accuracy tracking ekle
3. **P1:** Otomatik re-training pipeline
4. **P1:** A/B test altyapısı
5. **P1:** Query Fields production entegrasyonu
6. **P2:** Composed Model (kurum tipine göre)
7. **P2:** Feedback loop (kullanıcı düzeltmeleri → eğitim verisi)
8. **P2:** Cost monitoring dashboard

## Otomasyon Durumu
- Yarı-otomatik: train-model.mjs tek komutla çalışır ama tetikleme manuel
- Otomatik re-training YOK
- Model deploy (env güncelleme) manuel
- Rollback: formal mekanizma yok, .env'de eski model ID'ye dönülmeli
