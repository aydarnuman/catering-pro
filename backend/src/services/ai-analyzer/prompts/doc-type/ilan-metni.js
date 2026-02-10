/**
 * İhale İlanı Extraction Prompt
 * 
 * İhale ilanı metninden temel ihale bilgilerini çıkarır.
 * İlan metni genellikle ihalebul.com veya EKAP'tan scrape edilir.
 * 
 * İlan metninde bulunan tipik bilgiler:
 * - IKN, kurum adı, adres, telefon
 * - İhale tarihi, saati, süresi
 * - Miktarlar (öğün sayıları)
 * - Mali yeterlilik kriterleri (cari oran, özkaynak, ciro)
 * - İş deneyimi, benzer iş tanımı, kapasite
 * - Sınır değer katsayısı (R)
 * - Geçici teminat oranı
 * - Teklif türü
 */

export const ILAN_PROMPT = `Bu metin bir CATERİNG/YEMEK ihalesinin İLAN METNİDİR (EKAP veya ihalebul.com'dan).

## GÖREV: Aşağıdaki bilgileri ilan metninden çıkar.

JSON formatında döndür:
{
  "ozet": "İhalenin 2-3 cümlelik özeti (kurum, konu, miktar, süre)",
  
  "temel_bilgiler": {
    "ikn": "2025/XXXXXXX formatında İhale Kayıt Numarası",
    "kurum": "İhaleyi yapan kurum adı",
    "ihale_usulu": "Açık ihale / Pazarlık / Doğrudan temin",
    "teklif_turu": "birim_fiyat / goturu_bedel / karma",
    "tahmini_bedel": "Yaklaşık maliyet (TL cinsinden, varsa)"
  },
  
  "iletisim": {
    "adres": "Kurumun tam adresi (il/ilçe/mahalle/cadde dahil)",
    "telefon": "Telefon numarası (rakamları aynen yaz, format değiştirme)",
    "faks": "Faks numarası (varsa)",
    "email": "Email adresi (varsa, yoksa boş bırak)",
    "yetkili": "İlgili personel adı/ünvanı",
    "ekap_adresi": "EKAP sayfası URL'i (varsa)"
  },
  
  "tarihler": {
    "ihale_tarihi": "GG.AA.YYYY",
    "ihale_saati": "SS:DD",
    "ise_baslama": "GG.AA.YYYY",
    "is_bitis": "GG.AA.YYYY",
    "sure": "Toplam süre (ay veya gün)",
    "teklif_gecerlilik": "Süre (takvim günü)"
  },
  
  "miktarlar": {
    "toplam_ogun": "Toplam öğün sayısı (tüm kalemlerin toplamı)",
    "kalemler": [
      {"kalem": "Öğün/hizmet adı", "miktar": "sayı", "birim": "adet/öğün/ay"}
    ]
  },
  
  "mali_yeterlilik": {
    "cari_oran": "Minimum cari oran değeri (örn: 0,75)",
    "ozkaynak_orani": "Minimum özkaynak oranı (örn: 0,15)",
    "banka_borc_orani": "Banka borcu/özkaynak üst limiti (örn: < 0,50)",
    "toplam_ciro_orani": "Toplam ciro gereksinimi (örn: teklif bedelin %25)",
    "hizmet_ciro_orani": "Hizmet cirosu gereksinimi (örn: teklif bedelin %15)"
  },
  
  "mesleki_yeterlilik": {
    "is_deneyimi_orani": "İş deneyimi oranı (örn: teklif bedelin %30)",
    "is_deneyimi_sure": "Son kaç yıl (örn: 5 yıl)",
    "benzer_is_tanimi": "Benzer iş olarak kabul edilen işler (tam metin)",
    "kapasite_gereksinimi": "Günlük üretim kapasitesi (örn: 10.000 adet/gün)",
    "gerekli_belgeler": ["Belge adı ve açıklaması"]
  },
  
  "teminat": {
    "gecici_teminat": "Geçici teminat oranı (örn: %3)",
    "kesin_teminat": "Kesin teminat oranı (varsa)"
  },
  
  "sinir_deger": {
    "katsayi_R": "Sınır değer katsayısı (örn: 0,79)",
    "tur": "Malzemeli Yemek / Malzemesiz Yemek / Personel",
    "aciklama": "Aşırı düşük teklif açıklama yöntemi"
  },
  
  "diger": {
    "konsorsiyum": "Kabul ediliyor mu? (evet/hayır)",
    "alt_yuklenici": "İzin veriliyor mu? (evet/hayır)",
    "yerli_yabanci": "Sadece yerli / yerli+yabancı",
    "kismi_teklif": "Kısmi teklif verilebilir mi?"
  }
}

## KRİTİK KURALLAR:
1. SINIR DEĞER KATSAYISI (R) çok önemli - metinde "Sınır Değer Katsayısı" veya "(R)" arayın
2. TELEFON NUMARASI: Rakamları aynen yaz, "0xxx" gibi format kullanma
3. EMAIL: Metinde yoksa boş string "" bırak, "email@domain.com" gibi uydurma yazma
4. MALİ KRİTERLER: Cari oran, özkaynak, banka borcu oranlarını SAYI olarak yaz
5. CİRO GEREKSİNİMLERİ: Yüzde olarak yaz (örn: "%25")
6. BENZER İŞ: Tam tanımı kopyala, kısaltma
7. Metinde olmayan bilgiler için boş string "" kullan, "Belirtilmemiş" YAZMA
8. Sadece JSON döndür

## İLAN METNİ:
`;

export const ILAN_SCHEMA = {
  type: 'object',
  required: ['ozet', 'temel_bilgiler', 'iletisim', 'tarihler'],
};

export default {
  prompt: ILAN_PROMPT,
  schema: ILAN_SCHEMA,
  type: 'ilan',
};
