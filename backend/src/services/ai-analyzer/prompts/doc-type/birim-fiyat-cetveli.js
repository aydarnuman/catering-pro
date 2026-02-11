/**
 * Birim Fiyat Teklif Cetveli Extraction Prompt
 *
 * İhale birim fiyat teklif cetveli (genelde DOCX).
 * İş kalemleri, miktarları ve birimleri içerir.
 * Fiyat sütunları genellikle boştur (istekli dolduracak).
 */

export const BIRIM_FIYAT_PROMPT = `Bu metin bir CATERİNG/YEMEK ihalesinin BİRİM FİYAT TEKLİF CETVELİDİR.

Bu cetvel ihale kalemlerini, miktarlarını ve birimlerini listeler.

## GÖREV: Cetveldeki TÜM kalemleri çıkar.

JSON formatında döndür:
{
  "ozet": "Cetvelin özeti (kalem sayısı, toplam miktar)",
  
  "ikn": "İhale Kayıt Numarası (varsa)",
  
  "birim_fiyatlar": [
    {
      "sira": "Sıra numarası",
      "kalem": "İş kaleminin adı (aynen yaz)",
      "miktar": "Miktar (sayı)",
      "birim": "Birim (adet/öğün/ay/kg)",
      "birim_fiyat": "Fiyat (varsa, genelde boş)",
      "toplam": "Toplam (varsa, genelde boş)"
    }
  ],
  
  "toplam_miktar": "Tüm kalemlerin toplam miktarı",
  "kdv_notu": "KDV dahil/hariç bilgisi (varsa)"
}

## KURALLAR:
1. Her kalemi ayrı listele
2. "TOPLAM TUTAR" satırını ayrıca belirt (birim_fiyatlar'a ekleme)
3. Boş fiyat sütunları için boş string "" kullan
4. Sadece JSON döndür

## BİRİM FİYAT CETVELİ:
`;

export const BIRIM_FIYAT_SCHEMA = {
  type: 'object',
  required: ['birim_fiyatlar'],
};

export default {
  prompt: BIRIM_FIYAT_PROMPT,
  schema: BIRIM_FIYAT_SCHEMA,
  type: 'birim_fiyat_cetveli',
};
