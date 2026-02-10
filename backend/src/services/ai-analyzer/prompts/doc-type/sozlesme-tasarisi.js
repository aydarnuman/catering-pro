/**
 * Sözleşme Tasarısı Extraction Prompt
 * 
 * Sözleşme tasarısı, ceza koşulları, ödeme şartları, fiyat farkı,
 * iş artışı, süre ve operasyonel kuralları içerir.
 */

export const SOZLESME_PROMPT = `Bu metin bir CATERİNG/YEMEK ihalesinin SÖZLEŞME TASARISIDIR.

Sözleşme tasarısı ceza koşulları, ödeme şartları, iş artışı, fiyat farkı ve operasyonel kuralları içerir.

## GÖREV: Aşağıdaki bilgileri çıkar.

JSON formatında döndür:
{
  "ozet": "Sözleşmenin 2-3 cümlelik özeti",
  
  "iletisim": {
    "kurum": "İdare adı",
    "adres": "Tam adres",
    "telefon": "Telefon (rakamları aynen yaz)",
    "faks": "Faks numarası (varsa)",
    "email": "Email/e-posta adresi (varsa, yoksa boş bırak)"
  },
  
  "sozlesme_bilgileri": {
    "ikn": "İhale Kayıt Numarası",
    "sozlesme_turu": "birim_fiyat / goturu_bedel",
    "ise_baslama": "GG.AA.YYYY",
    "is_bitis": "GG.AA.YYYY",
    "toplam_sure": "Gün/ay olarak",
    "isyeri_teslimi": "Yapılacak mı, ne zaman?"
  },
  
  "ceza_kosullari": [
    {
      "tur": "genel_aykirlik / ozel_aykirlik / agir_aykirlik / gecikme / sozlesme_feshi",
      "oran": "Ceza oranı (binde 5, %1 vb.)",
      "baz": "Neyin üzerinden (ilk sözleşme bedeli / günlük bedel)",
      "tekrar_artisi": "Tekrar halinde artış (örn: %50 artırımlı)",
      "ust_limit": "Ceza üst sınırı (örn: sözleşme bedelinin %30)",
      "aciklama": "Cezanın detaylı açıklaması",
      "madde": "İlgili madde numarası",
      "fesih_kosulu": "Feshe yol açan durum varsa"
    }
  ],
  
  "odeme_kosullari": {
    "odeme_yeri": "Ödemenin yapılacağı kurum",
    "hakedis_suresi": "Hakediş tahakkuk süresi (örn: 30 gün)",
    "odeme_suresi": "Ödeme süresi (örn: 30 gün)",
    "avans": "Verilecek mi, oranı",
    "odeme_periyodu": "Aylık/haftalık hakediş"
  },
  
  "fiyat_farki": {
    "uygulanacak_mi": "evet / hayır / mücbir sebepte evet",
    "formul": "Fiyat farkı formülü (varsa)",
    "katsayilar": {"a1": "", "a2": "", "b1": "", "b2": ""},
    "aciklama": "Detaylı açıklama"
  },
  
  "is_artisi": {
    "oran": "Maksimum iş artışı oranı (örn: %20)",
    "kosullar": "İş artışı koşulları",
    "is_eksilisi": "İş eksilişi koşulları ve oranları"
  },
  
  "teminat": {
    "kesin_teminat": "Oran veya formül",
    "ek_kesin_teminat": "Oran (varsa)",
    "iade_kosulu": "Teminat iade koşulları"
  },
  
  "operasyonel_kurallar": {
    "alt_yuklenici": "İzin var mı?",
    "personel_kurallari": [
      "Personelle ilgili her kural (hijyen belgesi, kimlik listesi vb.)"
    ],
    "yemek_kurallari": [
      "Yemekle ilgili her kural (numune saklama, kumanya bildirim süresi vb.)"
    ],
    "muayene_kabul": "Muayene ve kabul prosedürü",
    "denetim": "Kontrol teşkilatı bilgisi"
  },
  
  "dokuman_oncelik_sirasi": [
    "Dokümanlar arası öncelik sıralaması (varsa)"
  ],
  
  "onemli_notlar": [
    {
      "not": "Sözleşmeye özel önemli koşul",
      "tur": "ceza/odeme/operasyonel/genel",
      "madde": "İlgili madde numarası"
    }
  ]
}

## KRİTİK KURALLAR:
1. CEZA KOŞULLARI çok önemli - oranı, bazı, tekrar artışını ve üst limiti MUTLAKA çıkar
2. TELEFON/EMAIL: Sözleşme tasarısında genellikle İdare iletişim bilgileri var - bunları aynen yaz
3. FİYAT FARKI: "hesaplanmayacaktır" bile olsa bunu belirt
4. KUMANYA/YEMEK KURALLARI: Bildirim süreleri, numune saklama gibi operasyonel detaylar çok önemli
5. PERSONEL KURALLARI: Hijyen belgesi süresi, kimlik listesi zorunluluğu vb.
6. Metinde olmayan bilgiler için boş string "" kullan
7. Sadece JSON döndür

## SÖZLEŞME TASARISI METNİ:
`;

export const SOZLESME_SCHEMA = {
  type: 'object',
  required: ['ozet', 'ceza_kosullari', 'odeme_kosullari'],
};

export default {
  prompt: SOZLESME_PROMPT,
  schema: SOZLESME_SCHEMA,
  type: 'sozlesme',
};
