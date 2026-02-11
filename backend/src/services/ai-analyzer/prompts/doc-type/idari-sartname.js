/**
 * İdari Şartname Extraction Prompt
 *
 * İdari şartname, ihale yeterlilik kriterlerinin ve prosedürlerin yer aldığı
 * en kapsamlı dokümandır. Mali/mesleki yeterlilik, teminat, belgeler burada.
 */

export const IDARI_PROMPT = `Bu metin bir CATERİNG/YEMEK ihalesinin İDARİ ŞARTNAMESİDİR.

İdari şartname, mali yeterlilik, iş deneyimi, belgeler ve ihale prosedürlerini içerir.

## GÖREV: Aşağıdaki bilgileri çıkar.

JSON formatında döndür:
{
  "ozet": "Şartnamenin 2-3 cümlelik özeti",
  
  "iletisim": {
    "kurum": "Kurum adı",
    "adres": "Tam adres",
    "telefon": "Telefon (rakamları aynen yaz)",
    "faks": "Faks numarası",
    "email": "Email adresi (varsa, yoksa boş)",
    "yetkili": "İlgili personel adı ve ünvanı"
  },
  
  "ihale_bilgileri": {
    "ikn": "İhale Kayıt Numarası",
    "ihale_tarihi": "GG.AA.YYYY",
    "ihale_saati": "SS:DD",
    "ihale_usulu": "Açık ihale / Pazarlık usulü",
    "teklif_turu": "birim_fiyat / goturu_bedel",
    "kismi_teklif": "evet/hayır",
    "yaklasik_maliyet": "Varsa TL cinsinden"
  },
  
  "sureler": {
    "ise_baslama": "GG.AA.YYYY",
    "is_bitis": "GG.AA.YYYY",
    "toplam_sure": "Ay veya gün",
    "teklif_gecerlilik": "Süre (takvim günü)"
  },
  
  "mali_yeterlilik": {
    "cari_oran": "Minimum değer (örn: 0,75)",
    "ozkaynak_orani": "Minimum değer (örn: 0,15)",
    "banka_borc_ozkaynak_orani": "Üst limit (örn: < 0,50)",
    "toplam_ciro_orani": "Teklif bedelinin yüzde kaçı (örn: %25)",
    "hizmet_ciro_orani": "Teklif bedelinin yüzde kaçı (örn: %15)",
    "bilanço_kriteri": "Üç kriterin birlikte sağlanması gerekli mi?"
  },
  
  "is_deneyimi": {
    "oran": "Teklif bedelinin yüzde kaçı (örn: %30)",
    "sure": "Son kaç yıl (örn: 5)",
    "pilot_ortak_orani": "İş ortaklığında pilot ortak minimum oranı (örn: %70)",
    "diger_ortak_min": "Diğer ortaklar minimum (örn: %10)",
    "detay": "Ek koşullar varsa"
  },
  
  "benzer_is": {
    "tanim": "Benzer iş olarak kabul edilen işlerin TAM tanımı",
    "detay": "Ek açıklamalar"
  },
  
  "kapasite": {
    "gereksinim": "Günlük üretim kapasitesi (örn: 10.000 adet)",
    "belge": "Kapasite raporu detayı"
  },
  
  "teminat": {
    "gecici": "Oran (örn: %3)",
    "kesin": "Oran (örn: %6)",
    "ek_kesin": "Oran (varsa)"
  },
  
  "gerekli_belgeler": [
    {
      "belge": "Belge adı",
      "zorunlu": true,
      "aciklama": "Detaylı açıklama",
      "is_ortakligi_notu": "İş ortaklığında nasıl sunulacağı"
    }
  ],
  
  "sinir_deger": {
    "katsayi_R": "Değer (örn: 0,79)",
    "tur": "Malzemeli Yemek / Malzemesiz",
    "asiri_dusuk_aciklama": "Kanun 38. madde uygulanacak mı?"
  },
  
  "diger_kosullar": {
    "konsorsiyum": "Kabul/red",
    "alt_yuklenici": "İzin var mı?",
    "yerli_yabanci": "Yerli/yabancı açıklığı",
    "fiyat_disi_unsur": "Varsa puanlama kriterleri",
    "ekonomik_kriter": "Sadece fiyat mı, fiyat dışı unsur var mı?"
  },
  
  "onemli_notlar": [
    {
      "not": "Önemli koşul veya uyarı",
      "tur": "gereklilik/uyari/bilgi/kisitlama",
      "madde": "İlgili madde numarası"
    }
  ]
}

## KRİTİK KURALLAR:
1. MALİ KRİTERLER: Cari oran, özkaynak, banka borcu değerlerini MUTLAKA çıkar
2. CİRO: Toplam ciro ve hizmet cirosu ayrı ayrı yaz
3. İŞ DENEYİMİ: Oran + süre + pilot/diğer ortak detayları
4. TELEFON: Gerçek numarayı yaz, placeholder kullanma
5. EMAIL: Metinde yoksa boş "" bırak
6. BELGELER: Her belgenin adını ve açıklamasını tam yaz
7. BENZER İŞ: Tanımı kelimesi kelimesine kopyala
8. Metinde olmayan bilgiler için boş string "" kullan
9. Sadece JSON döndür

## İDARİ ŞARTNAME METNİ:
`;

export const IDARI_SCHEMA = {
  type: 'object',
  required: ['ozet', 'mali_yeterlilik', 'teminat', 'gerekli_belgeler'],
};

export default {
  prompt: IDARI_PROMPT,
  schema: IDARI_SCHEMA,
  type: 'idari_sartname',
};
