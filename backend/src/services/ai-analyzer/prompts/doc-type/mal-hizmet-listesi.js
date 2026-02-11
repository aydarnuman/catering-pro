/**
 * Mal/Hizmet Listesi Extraction Prompt
 *
 * ihalebul.com'dan scrape edilen mal/hizmet listesi.
 * Genellikle kalem, miktar, birim bilgilerini içerir.
 * Bu veriler birim fiyat cetvelinin temelini oluşturur.
 */

export const MAL_HIZMET_PROMPT = `Bu metin bir CATERİNG/YEMEK ihalesinin MAL/HİZMET LİSTESİDİR.

Bu liste ihale kapsamındaki iş kalemlerini, miktarlarını ve birimlerini içerir.

## GÖREV: Listedeki TÜM kalemleri çıkar.

JSON formatında döndür:
{
  "ozet": "Listenin 1-2 cümlelik özeti (toplam kalem sayısı, toplam miktar)",
  
  "birim_fiyatlar": [
    {
      "sira": "Sıra numarası",
      "kalem": "İş kalemi / öğün / hizmet adı (aynen yaz)",
      "miktar": "Miktar (sayı olarak, nokta ayracı olmadan)",
      "birim": "Birim (adet/öğün/ay/kg/porsiyon)",
      "birim_fiyat": "Birim fiyat (varsa, genelde boş olur)",
      "toplam": "Toplam tutar (varsa, genelde boş olur)"
    }
  ],
  
  "toplam_miktar": "Tüm kalemlerin toplam miktarı",
  "kalem_sayisi": "Toplam kalem sayısı",
  
  "ogun_bilgileri": [
    {
      "tur": "Sıcak Yemek / Kumanya / Kahvaltı / Diyet / Ara Öğün / vb.",
      "miktar": "Toplam miktar (sayı)",
      "birim": "adet/öğün"
    }
  ]
}

## KURALLAR:
1. Her kalemi AYRI AYRI listele, birleştirme
2. Miktarları sayı olarak yaz (40.000 → 40000 veya "40.000")
3. Birim fiyat ve toplam genelde boştur (istekli dolduracak) - boş bırak
4. Sadece JSON döndür

## MAL/HİZMET LİSTESİ:
`;

export const MAL_HIZMET_SCHEMA = {
  type: 'object',
  required: ['birim_fiyatlar'],
};

export default {
  prompt: MAL_HIZMET_PROMPT,
  schema: MAL_HIZMET_SCHEMA,
  type: 'mal_hizmet_listesi',
};
