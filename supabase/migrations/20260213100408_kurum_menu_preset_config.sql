-- kurum_tipleri tablosuna preset_config JSONB kolonu ekle
ALTER TABLE kurum_tipleri ADD COLUMN IF NOT EXISTS preset_config JSONB DEFAULT '{}'::jsonb;

-- 8 kurum icin preset kurallari
UPDATE kurum_tipleri SET preset_config = '{
  "gunluk_kalori_hedef": { "min": 2200, "max": 2800 },
  "ogun_yapisi": "3_ogun",
  "ogun_cesit": {
    "kahvalti": ["kahvaltilik"],
    "ogle": ["corba", "ana_yemek", "pilav_makarna", "salata_meze", "icecek"],
    "aksam": ["corba", "ana_yemek", "pilav_makarna", "tatli", "icecek"]
  },
  "haftalik_zorunlu": {
    "balik": 1, "kuru_baklagil": 2, "tavuk_yemegi": 2, "sebze_yemegi": 2
  },
  "rotasyon": {
    "ayni_corba_min_aralik": 3, "ayni_ana_yemek_min_aralik": 5, "ayni_pilav_min_aralik": 2
  },
  "haric_tutma": [],
  "mevsim_tercihi": "auto",
  "maliyet_limit_porsiyon": { "ekonomik": 35, "standart": 55, "premium": 80 },
  "ozel_notlar": "Ogrenci beslenme standartlari. Makarna/pilav agirlikli, ekonomik tercihler oncelikli. Gencler icin yuksek karbonhidrat."
}'::jsonb WHERE kod = 'kyk';

UPDATE kurum_tipleri SET preset_config = '{
  "gunluk_kalori_hedef": { "min": 1800, "max": 2200 },
  "ogun_yapisi": "3_ogun",
  "ogun_cesit": {
    "kahvalti": ["kahvaltilik"],
    "ogle": ["corba", "ana_yemek", "pilav_makarna", "salata_meze", "icecek"],
    "aksam": ["corba", "ana_yemek", "salata_meze", "tatli", "icecek"]
  },
  "haftalik_zorunlu": {
    "balik": 2, "kuru_baklagil": 1, "tavuk_yemegi": 2, "sebze_yemegi": 3
  },
  "rotasyon": {
    "ayni_corba_min_aralik": 3, "ayni_ana_yemek_min_aralik": 4, "ayni_pilav_min_aralik": 2
  },
  "haric_tutma": [],
  "mevsim_tercihi": "auto",
  "maliyet_limit_porsiyon": { "ekonomik": 40, "standart": 65, "premium": 95 },
  "ozel_notlar": "Hasta beslenmesi oncelikli. Tuzsuz/diyetik secenekler. Yumusak, sindirimi kolay gidalar. Lifli sebzeler oncelikli. Agir baharatlardan kacin."
}'::jsonb WHERE kod = 'hastane';

UPDATE kurum_tipleri SET preset_config = '{
  "gunluk_kalori_hedef": { "min": 2800, "max": 3500 },
  "ogun_yapisi": "3_ogun",
  "ogun_cesit": {
    "kahvalti": ["kahvaltilik"],
    "ogle": ["corba", "ana_yemek", "pilav_makarna", "salata_meze", "icecek"],
    "aksam": ["corba", "ana_yemek", "pilav_makarna", "tatli", "icecek"]
  },
  "haftalik_zorunlu": {
    "balik": 1, "kuru_baklagil": 3, "tavuk_yemegi": 2, "sebze_yemegi": 1
  },
  "rotasyon": {
    "ayni_corba_min_aralik": 2, "ayni_ana_yemek_min_aralik": 4, "ayni_pilav_min_aralik": 2
  },
  "haric_tutma": ["domuz"],
  "mevsim_tercihi": "auto",
  "maliyet_limit_porsiyon": { "ekonomik": 40, "standart": 60, "premium": 85 },
  "ozel_notlar": "Askeri personel beslenmesi. Yuksek protein ve kalori. Agir fiziksel aktivite icin enerji yogun ogunler. Doyurucu, tok tutan yemekler."
}'::jsonb WHERE kod = 'askeri';

UPDATE kurum_tipleri SET preset_config = '{
  "gunluk_kalori_hedef": { "min": 1500, "max": 2000 },
  "ogun_yapisi": "2_ogun",
  "ogun_cesit": {
    "ogle": ["corba", "ana_yemek", "pilav_makarna", "salata_meze", "icecek"],
    "aksam": []
  },
  "haftalik_zorunlu": {
    "balik": 1, "kuru_baklagil": 1, "tavuk_yemegi": 2, "sebze_yemegi": 2
  },
  "rotasyon": {
    "ayni_corba_min_aralik": 3, "ayni_ana_yemek_min_aralik": 5, "ayni_pilav_min_aralik": 2
  },
  "haric_tutma": [],
  "mevsim_tercihi": "auto",
  "maliyet_limit_porsiyon": { "ekonomik": 25, "standart": 40, "premium": 60 },
  "ozel_notlar": "Cocuk beslenmesi. Renkli tabak kurali - her ogunde en az 3 farkli renk. Cocuk dostu porsiyonlar. Sebze gizleme stratejileri."
}'::jsonb WHERE kod = 'okul';

UPDATE kurum_tipleri SET preset_config = '{
  "gunluk_kalori_hedef": { "min": 2000, "max": 2500 },
  "ogun_yapisi": "3_ogun",
  "ogun_cesit": {
    "kahvalti": ["kahvaltilik"],
    "ogle": ["corba", "ana_yemek", "pilav_makarna", "salata_meze", "icecek"],
    "aksam": ["corba", "ana_yemek", "pilav_makarna", "salata_meze", "icecek"]
  },
  "haftalik_zorunlu": {
    "balik": 1, "kuru_baklagil": 3, "tavuk_yemegi": 1, "sebze_yemegi": 2
  },
  "rotasyon": {
    "ayni_corba_min_aralik": 2, "ayni_ana_yemek_min_aralik": 4, "ayni_pilav_min_aralik": 2
  },
  "haric_tutma": [],
  "mevsim_tercihi": "auto",
  "maliyet_limit_porsiyon": { "ekonomik": 30, "standart": 45, "premium": 70 },
  "ozel_notlar": "Belediye asevi/sosyal tesis. Ekonomik agirlikli, buyuk porsiyon. Doyurucu baklagil ve tahil agirlikli menu."
}'::jsonb WHERE kod = 'belediye';

UPDATE kurum_tipleri SET preset_config = '{
  "gunluk_kalori_hedef": { "min": 2000, "max": 2500 },
  "ogun_yapisi": "2_ogun",
  "ogun_cesit": {
    "ogle": ["corba", "ana_yemek", "pilav_makarna", "salata_meze", "tatli", "icecek"],
    "aksam": []
  },
  "haftalik_zorunlu": {
    "balik": 2, "kuru_baklagil": 1, "tavuk_yemegi": 2, "sebze_yemegi": 2
  },
  "rotasyon": {
    "ayni_corba_min_aralik": 4, "ayni_ana_yemek_min_aralik": 6, "ayni_pilav_min_aralik": 3
  },
  "haric_tutma": [],
  "mevsim_tercihi": "auto",
  "maliyet_limit_porsiyon": { "ekonomik": 45, "standart": 70, "premium": 110 },
  "ozel_notlar": "Ozel sektor yemekhanesi. Yuksek cesitlilik, sunum kalitesi onemli. Farkli mutfak kulturleri (Akdeniz, Uzakdogu vb). Sagladi secenekler sunulmali."
}'::jsonb WHERE kod = 'ozel_sektor';

UPDATE kurum_tipleri SET preset_config = '{
  "gunluk_kalori_hedef": { "min": 1600, "max": 2000 },
  "ogun_yapisi": "3_ogun",
  "ogun_cesit": {
    "kahvalti": ["kahvaltilik"],
    "ogle": ["corba", "ana_yemek", "pilav_makarna", "salata_meze", "icecek"],
    "aksam": ["corba", "ana_yemek", "salata_meze", "tatli", "icecek"]
  },
  "haftalik_zorunlu": {
    "balik": 2, "kuru_baklagil": 2, "tavuk_yemegi": 2, "sebze_yemegi": 3
  },
  "rotasyon": {
    "ayni_corba_min_aralik": 3, "ayni_ana_yemek_min_aralik": 5, "ayni_pilav_min_aralik": 2
  },
  "haric_tutma": [],
  "mevsim_tercihi": "auto",
  "maliyet_limit_porsiyon": { "ekonomik": 35, "standart": 55, "premium": 80 },
  "ozel_notlar": "Yasli bakim. Yumusak ve kolay cignenen gidalar. Sindirimi kolay. Lifli sebzeler. Kemik suyu bazli corbalar. Kalsiyum ve D vitamini acisından zengin."
}'::jsonb WHERE kod = 'huzurevi';

UPDATE kurum_tipleri SET preset_config = '{
  "gunluk_kalori_hedef": { "min": 2200, "max": 2600 },
  "ogun_yapisi": "3_ogun",
  "ogun_cesit": {
    "kahvalti": ["kahvaltilik"],
    "ogle": ["corba", "ana_yemek", "pilav_makarna", "salata_meze", "icecek"],
    "aksam": ["corba", "ana_yemek", "pilav_makarna", "icecek"]
  },
  "haftalik_zorunlu": {
    "balik": 1, "kuru_baklagil": 3, "tavuk_yemegi": 2, "sebze_yemegi": 2
  },
  "rotasyon": {
    "ayni_corba_min_aralik": 2, "ayni_ana_yemek_min_aralik": 4, "ayni_pilav_min_aralik": 2
  },
  "haric_tutma": ["domuz", "alkol"],
  "mevsim_tercihi": "auto",
  "maliyet_limit_porsiyon": { "ekonomik": 30, "standart": 45, "premium": 65 },
  "ozel_notlar": "Ceza infaz kurumu. Maliyet optimize, temel beslenme standartlari. Helal gida zorunlu. Doyurucu baklagil ve tahil agirlikli."
}'::jsonb WHERE kod = 'cezaevi';
