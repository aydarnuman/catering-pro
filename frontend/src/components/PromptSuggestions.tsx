'use client';

/**
 * PromptSuggestions - v0-tarzi prompt oneri sistemi
 *
 * Sayfa/modul bazli kontekst-duyarli prompt onerileri gosterir.
 * Tiklaninca onSelect callback ile secilen prompt'u input'a yazar.
 * Compact (floating chat) ve full (sayfa) modlarini destekler.
 */

import {
  Box,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { IconArrowRight, IconSparkles } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

// --- Tipler ---

type SuggestionCategory = 'all' | 'analiz' | 'rapor' | 'islem' | 'soru';

interface PromptSuggestion {
  icon: string;
  title: string;
  prompt: string;
  category: Exclude<SuggestionCategory, 'all'>;
}

interface PromptSuggestionsProps {
  department: string;
  onSelect: (prompt: string) => void;
  compact?: boolean;
  godMode?: boolean;
}

// --- Kategori Tanimlari ---

const CATEGORIES: Array<{ id: SuggestionCategory; label: string; icon: string }> = [
  { id: 'all', label: 'Hepsi', icon: '✨' },
  { id: 'analiz', label: 'Analiz', icon: '📊' },
  { id: 'rapor', label: 'Rapor', icon: '📋' },
  { id: 'islem', label: 'Islem', icon: '⚡' },
  { id: 'soru', label: 'Soru', icon: '❓' },
];

// --- Department Bazli Prompt Onerileri ---

const SUGGESTIONS: Record<string, PromptSuggestion[]> = {
  FATURA: [
    {
      icon: '📊',
      title: 'Fatura ozeti',
      prompt: 'Bu ayin fatura ozetini cikar: toplam tutar, KDV, odenen ve bekleyen',
      category: 'rapor',
    },
    {
      icon: '⏰',
      title: 'Geciken faturalar',
      prompt: 'Vadesi gecmis odemeleri listele, toplam tutari ve gecikme surelerini goster',
      category: 'soru',
    },
    {
      icon: '📈',
      title: 'Aylik karsilastirma',
      prompt: 'Son 3 ayin fatura tutarlarini karsilastir, artis/azalis yuzdelerini hesapla',
      category: 'analiz',
    },
    {
      icon: '🏢',
      title: 'Cari bakiye',
      prompt: 'Tum carilerin guncel bakiyelerini goster, borc ve alacak toplamlarini hesapla',
      category: 'soru',
    },
    {
      icon: '💰',
      title: 'KDV raporu',
      prompt: 'Bu ayin KDV raporunu olustur: odenen ve hesaplanan KDV farki',
      category: 'rapor',
    },
    {
      icon: '🧾',
      title: 'Fatura olustur',
      prompt: 'Yeni satis faturasi olusturmak istiyorum, bana yardimci ol',
      category: 'islem',
    },
    {
      icon: '📉',
      title: 'Maliyet analizi',
      prompt: 'En cok harcama yaptigimiz kalemlerin maliyet analizini yap',
      category: 'analiz',
    },
    {
      icon: '🔍',
      title: 'Fatura ara',
      prompt: 'Son 1 hafta icinde kesilen faturalari listele',
      category: 'soru',
    },
  ],

  PERSONEL: [
    {
      icon: '👥',
      title: 'Personel ozeti',
      prompt: 'Aktif personel sayisi, departman dagilimi ve ortalama kidem suresini goster',
      category: 'rapor',
    },
    {
      icon: '💰',
      title: 'Bordro hesapla',
      prompt: 'Tum personelin bu ayki bordro hesaplamasini yap, SGK ve vergi kesintileriyle',
      category: 'islem',
    },
    {
      icon: '📅',
      title: 'Izin bakiyesi',
      prompt: 'Personellerin yillik izin bakiyelerini listele, kullanilan ve kalan gunleri goster',
      category: 'soru',
    },
    {
      icon: '🧮',
      title: 'Maliyet analizi',
      prompt: 'Toplam personel maliyetini hesapla: maas, SGK, yemek, ulasim dahil',
      category: 'analiz',
    },
    {
      icon: '📊',
      title: 'Kidem hesaplama',
      prompt: 'Her personelin kidem tazminati tutarini hesapla',
      category: 'islem',
    },
    {
      icon: '⚠️',
      title: 'SGK bildirgeleri',
      prompt: 'Bu ayin SGK bildirgesi icin gerekli verileri hazirla',
      category: 'rapor',
    },
    {
      icon: '📈',
      title: 'Maas karsilastirma',
      prompt: 'Departman bazli ortalama maas karsilastirmasi yap',
      category: 'analiz',
    },
    {
      icon: '🔄',
      title: 'Vardiya plani',
      prompt: 'Onumuzdeki hafta icin vardiya planini olustur',
      category: 'islem',
    },
  ],

  IHALE: [
    {
      icon: '📋',
      title: 'Yaklasan ihaleler',
      prompt: 'Son basvuru tarihi yaklasan ihaleleri oncelik sirasina gore listele',
      category: 'soru',
    },
    {
      icon: '🎯',
      title: 'Kazanma analizi',
      prompt: 'Kazanma sansi en yuksek ihaleleri analiz et, nedenlerini acikla',
      category: 'analiz',
    },
    {
      icon: '📊',
      title: 'Basari orani',
      prompt: 'Ihale basari oranini hesapla: katildik, kazandik, kaybettik dagilimi',
      category: 'rapor',
    },
    {
      icon: '🏢',
      title: 'Rakip analizi',
      prompt: 'Son ihalelerde en cok karsilastigimiz rakipleri ve fiyat stratejilerini analiz et',
      category: 'analiz',
    },
    {
      icon: '💰',
      title: 'Teklif hesapla',
      prompt: 'Secili ihale icin maliyet tablosunu cikar ve teklif fiyati oner',
      category: 'islem',
    },
    {
      icon: '📈',
      title: 'Trend analizi',
      prompt: 'Son 6 aydaki ihale trendlerini analiz et: sektor, bolge, butce dagilimi',
      category: 'analiz',
    },
    {
      icon: '📄',
      title: 'Dokuman ozeti',
      prompt: 'Ihale sartname dokumaninin ozetini cikar, kritik kosullari vurgula',
      category: 'rapor',
    },
    {
      icon: '⚠️',
      title: 'Risk degerlendirme',
      prompt: 'Aktif ihalelerin risk degerlendirmesini yap, potansiyel sorunlari belirle',
      category: 'analiz',
    },
  ],

  SATIN_ALMA: [
    {
      icon: '📦',
      title: 'Bekleyen siparisler',
      prompt: 'Bekleyen satin alma siparislerini listele, teslimat durumlarini goster',
      category: 'soru',
    },
    {
      icon: '🛒',
      title: 'Siparis olustur',
      prompt: 'Yeni satin alma siparisi olusturmak istiyorum',
      category: 'islem',
    },
    {
      icon: '🏭',
      title: 'Tedarikci karsilastir',
      prompt: 'En cok alisveris yaptigimiz tedarikçileri karsilastir: fiyat, teslimat suresi, kalite',
      category: 'analiz',
    },
    {
      icon: '💰',
      title: 'Harcama raporu',
      prompt: 'Bu ayin satin alma harcama raporunu kategori bazli olustur',
      category: 'rapor',
    },
    {
      icon: '📉',
      title: 'Fiyat takibi',
      prompt: 'Temel gida maddelerinin son 3 aydaki fiyat degisimlerini goster',
      category: 'analiz',
    },
    {
      icon: '📊',
      title: 'Stok ihtiyaci',
      prompt: 'Mevcut stok durumuna gore satin alinmasi gereken urunleri listele',
      category: 'soru',
    },
    {
      icon: '🔄',
      title: 'Otomatik siparis',
      prompt: 'Kritik stok seviyesinin altindaki urunler icin otomatik siparis onerisi olustur',
      category: 'islem',
    },
    {
      icon: '📋',
      title: 'Tedarikci raporu',
      prompt: 'Tedarikci performans raporunu olustur: zamaninda teslimat orani ve kalite puani',
      category: 'rapor',
    },
  ],

  STOK: [
    {
      icon: '📦',
      title: 'Stok durumu',
      prompt: 'Guncel stok durumunu goster: toplam kalem, kritik seviye, deger',
      category: 'soru',
    },
    {
      icon: '⚠️',
      title: 'Kritik stoklar',
      prompt: 'Minimum stok seviyesinin altina dusen urunleri acil olarak listele',
      category: 'soru',
    },
    {
      icon: '📊',
      title: 'Stok hareket',
      prompt: 'Bu ayin stok giris-cikis hareketlerinin ozetini cikar',
      category: 'rapor',
    },
    {
      icon: '💰',
      title: 'Stok degeri',
      prompt: 'Toplam stok degerini kategori bazli hesapla',
      category: 'analiz',
    },
    {
      icon: '📈',
      title: 'Tuketim analizi',
      prompt: 'En cok tuketilen urunlerin son 3 aylik tuketim trendini analiz et',
      category: 'analiz',
    },
    {
      icon: '🔄',
      title: 'Stok sayimi',
      prompt: 'Stok sayim raporu olustur, fiili ve kaydi stok farklarini goster',
      category: 'islem',
    },
    {
      icon: '📉',
      title: 'Fire analizi',
      prompt: 'Urun bazli fire oranlarini hesapla ve yuksek fireli urunleri raporla',
      category: 'analiz',
    },
    {
      icon: '📋',
      title: 'Depo raporu',
      prompt: 'Depo doluluk oranini ve kategori bazli dagilimi goster',
      category: 'rapor',
    },
  ],

  MENU_PLANLAMA: [
    {
      icon: '📅',
      title: 'Aylik menu',
      prompt: 'Onumuzdeki ay icin 1000 kisilik KYK menüsü olustur, diyet cesitliligiyle',
      category: 'islem',
    },
    {
      icon: '📋',
      title: 'Recete listesi',
      prompt: 'Tum receteleri kategorilere gore listele, porsiyon maliyetleriyle',
      category: 'rapor',
    },
    {
      icon: '💰',
      title: 'Maliyet hesapla',
      prompt: 'Secili menuenun toplam maliyetini hesapla, kisi basi tutar goster',
      category: 'analiz',
    },
    {
      icon: '🍽️',
      title: 'Menu oner',
      prompt: 'Butceye uygun haftalik ogle menusu oner, besin degerleriyle birlikte',
      category: 'islem',
    },
    {
      icon: '📊',
      title: 'Besin analizi',
      prompt: 'Bu haftaki menunun besin degeri analizini yap: kalori, protein, karbonhidrat',
      category: 'analiz',
    },
    {
      icon: '🥗',
      title: 'Diyet menusu',
      prompt: 'Diyabet ve tansiyon hastalari icin ozel menu olustur',
      category: 'islem',
    },
    {
      icon: '📈',
      title: 'Maliyet trendi',
      prompt: 'Son 6 aydaki ortalama porsiyon maliyeti trendini goster',
      category: 'analiz',
    },
    {
      icon: '🔄',
      title: 'Recete guncelle',
      prompt: 'Guncel piyasa fiyatlarina gore recete maliyetlerini yeniden hesapla',
      category: 'islem',
    },
  ],

  GELIR_GIDER: [
    {
      icon: '📊',
      title: 'Gelir-gider ozeti',
      prompt: 'Bu ayin gelir-gider ozetini cikar, kar/zarar durumunu goster',
      category: 'rapor',
    },
    {
      icon: '📈',
      title: 'Trend analizi',
      prompt: 'Son 6 ayin gelir-gider trendini analiz et, tahmin olustur',
      category: 'analiz',
    },
    {
      icon: '💰',
      title: 'Butce karsilastirma',
      prompt: 'Gerceklesen harcamalari butce ile karsilastir, sapmalari goster',
      category: 'analiz',
    },
    {
      icon: '📋',
      title: 'Detayli rapor',
      prompt: 'Kategori bazli detayli gelir-gider raporu olustur',
      category: 'rapor',
    },
    {
      icon: '⚠️',
      title: 'Butce uyarisi',
      prompt: 'Butceyi asan kalemleri listele ve tasarruf onerileri sun',
      category: 'soru',
    },
    {
      icon: '🏢',
      title: 'Proje bazli',
      prompt: 'Her projenin ayri ayri gelir-gider durumunu goster',
      category: 'rapor',
    },
    {
      icon: '📉',
      title: 'Maliyet optimizasyon',
      prompt: 'En cok harcama yapilan kalemlerde tasarruf firsatlarini analiz et',
      category: 'analiz',
    },
    {
      icon: '🔮',
      title: 'Tahmin',
      prompt: 'Onumuzdeki 3 ay icin gelir-gider tahmini yap',
      category: 'analiz',
    },
  ],

  KASA_BANKA: [
    {
      icon: '🏦',
      title: 'Kasa durumu',
      prompt: 'Guncel kasa ve banka bakiyelerini goster',
      category: 'soru',
    },
    {
      icon: '💸',
      title: 'Nakit akis',
      prompt: 'Bu ayin nakit akis tablosunu olustur',
      category: 'rapor',
    },
    {
      icon: '📊',
      title: 'Banka hareketleri',
      prompt: 'Son 1 haftanin banka hareketlerini listele',
      category: 'soru',
    },
    {
      icon: '💰',
      title: 'Tahsilat durumu',
      prompt: 'Bekleyen tahsilatlari vadelerine gore listele',
      category: 'soru',
    },
    {
      icon: '📈',
      title: 'Likidite analizi',
      prompt: 'Likidite durumunu analiz et, onumuzdeki hafta icin nakit ihtiyacini hesapla',
      category: 'analiz',
    },
    {
      icon: '🔄',
      title: 'Virman yap',
      prompt: 'Hesaplar arasi virman islemi yapmak istiyorum',
      category: 'islem',
    },
    {
      icon: '📋',
      title: 'Cek/senet takip',
      prompt: 'Vadesi yaklasan cek ve senetleri listele',
      category: 'soru',
    },
    {
      icon: '⚠️',
      title: 'Odeme plani',
      prompt: 'Bu haftaki odeme planini olustur, onceliklere gore sirala',
      category: 'islem',
    },
  ],

  RAPOR: [
    {
      icon: '📊',
      title: 'Genel ozet',
      prompt: 'Tum sistemin genel ozetini cikar: gelir, gider, stok, personel',
      category: 'rapor',
    },
    {
      icon: '📈',
      title: 'Performans raporu',
      prompt: 'Bu ayin operasyonel performans raporunu olustur',
      category: 'rapor',
    },
    {
      icon: '💰',
      title: 'Finansal analiz',
      prompt: 'Detayli finansal analiz raporu: kar/zarar, nakit akis, bilanço',
      category: 'analiz',
    },
    {
      icon: '🏢',
      title: 'Proje karsilastirma',
      prompt: 'Projeler arasi performans karsilastirmasi yap',
      category: 'analiz',
    },
    {
      icon: '📋',
      title: 'Haftalik rapor',
      prompt: 'Bu haftanin ozet raporunu olustur, onemli gelismeleri vurgula',
      category: 'rapor',
    },
    {
      icon: '📉',
      title: 'Sapma analizi',
      prompt: 'Butce sapma analizini yap, nedenleriyle birlikte raporla',
      category: 'analiz',
    },
    {
      icon: '🔮',
      title: 'Tahmin raporu',
      prompt: 'Onumuzdeki ceyrek icin gelir ve gider tahmini olustur',
      category: 'analiz',
    },
    {
      icon: '⚠️',
      title: 'Uyari raporu',
      prompt: 'Dikkat edilmesi gereken kritik konulari raporla',
      category: 'soru',
    },
  ],

  'TÜM SİSTEM': [
    {
      icon: '📊',
      title: 'Sistem ozeti',
      prompt: 'Tum sistemin genel durumunu ozetle: bekleyen isler, uyarilar, onemli rakamlar',
      category: 'rapor',
    },
    {
      icon: '💰',
      title: 'Harcama raporu',
      prompt: 'Proje bazli harcama raporunu goster, bu ayin en buyuk kalemleriyle',
      category: 'rapor',
    },
    {
      icon: '📦',
      title: 'Siparis durumu',
      prompt: 'Bekleyen ve aktif siparislerin durumunu goster',
      category: 'soru',
    },
    {
      icon: '🏢',
      title: 'Tedarikci analizi',
      prompt: 'En cok alisveris yaptigimiz tedarikçileri ve toplam tutarlari listele',
      category: 'analiz',
    },
    {
      icon: '📈',
      title: 'Trend analizi',
      prompt: 'Son 3 ayin genel performans trendini analiz et',
      category: 'analiz',
    },
    {
      icon: '📋',
      title: 'Yaklasan ihaleler',
      prompt: 'Yaklasan ihale son basvuru tarihlerini ve durumlarini listele',
      category: 'soru',
    },
    {
      icon: '⚠️',
      title: 'Kritik uyarilar',
      prompt: 'Tum modullerdeki kritik uyarilari ve dikkat gerektiren konulari listele',
      category: 'soru',
    },
    {
      icon: '🛒',
      title: 'Siparis olustur',
      prompt: 'Yeni satin alma siparisi olusturmak istiyorum',
      category: 'islem',
    },
    {
      icon: '🔮',
      title: 'Butce tahmini',
      prompt: 'Onumuzdeki ay icin butce tahmini olustur',
      category: 'analiz',
    },
    {
      icon: '📊',
      title: 'KPI ozeti',
      prompt: 'Temel performans gostergelerinin (KPI) ozetini cikar',
      category: 'rapor',
    },
  ],

  GOD_MODE: [
    {
      icon: '🔥',
      title: 'SQL calistir',
      prompt: 'SELECT COUNT(*) FROM users sorgusunu calistir',
      category: 'islem',
    },
    {
      icon: '📁',
      title: 'Dosya listele',
      prompt: 'Backend src klasorundeki tum dosyalari listele',
      category: 'soru',
    },
    {
      icon: '🔑',
      title: 'Secret listele',
      prompt: 'Sistemdeki tum API keylerini ve secretlari listele',
      category: 'soru',
    },
    {
      icon: '⚡',
      title: 'Shell komutu',
      prompt: 'df -h komutu ile disk kullanimini goster',
      category: 'islem',
    },
    {
      icon: '📊',
      title: 'DB tablolari',
      prompt: 'Veritabanindaki tum tablolari ve satir sayilarini listele',
      category: 'soru',
    },
    {
      icon: '🔧',
      title: 'Sistem durumu',
      prompt: 'PM2 status, disk, RAM ve CPU kullanimini goster',
      category: 'soru',
    },
    {
      icon: '📋',
      title: 'Log incele',
      prompt: 'Son 50 satir backend logunu goster',
      category: 'rapor',
    },
    {
      icon: '🧪',
      title: 'Kod calistir',
      prompt: 'Supabase baglantisini test et ve sonucu goster',
      category: 'islem',
    },
  ],
};

// --- Component ---

export function PromptSuggestions({ department, onSelect, compact = false, godMode = false }: PromptSuggestionsProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [activeCategory, setActiveCategory] = useState<SuggestionCategory>('all');

  // Department'a gore prompt listesini al
  const suggestions = useMemo(() => {
    if (godMode) return SUGGESTIONS.GOD_MODE || [];
    return SUGGESTIONS[department] || SUGGESTIONS['TÜM SİSTEM'] || [];
  }, [department, godMode]);

  // Kategoriye gore filtrele
  const filtered = useMemo(() => {
    if (activeCategory === 'all') return suggestions;
    return suggestions.filter((s) => s.category === activeCategory);
  }, [suggestions, activeCategory]);

  // Compact: max 6, Full: hepsi
  const visible = compact ? filtered.slice(0, 6) : filtered;

  return (
    <Stack gap={compact ? 'xs' : 'md'} w="100%">
      {/* Baslik - sadece full modda */}
      {!compact && (
        <Stack gap={4} align="center">
          <Box
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: godMode
                ? 'linear-gradient(135deg, rgba(255,71,87,0.15), rgba(255,140,0,0.1))'
                : isDark
                  ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(99,102,241,0.15))'
                  : 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,102,241,0.08))',
            }}
          >
            <IconSparkles size={24} color={godMode ? '#ff4757' : 'var(--mantine-color-violet-5)'} />
          </Box>
          <Text size="lg" fw={600} ta="center" style={{ letterSpacing: '-0.02em' }}>
            {godMode ? 'God Mode' : 'Ne yapmak istiyorsunuz?'}
          </Text>
          <Text size="xs" c="dimmed" ta="center" maw={360}>
            {godMode ? 'Sinursiz yetki ile SQL, dosya ve shell islemleri' : 'Bir oneri secin veya kendi sorunuzu yazin'}
          </Text>
        </Stack>
      )}

      {/* Compact baslik */}
      {compact && (
        <Text size="xs" c="dimmed" ta="center" mt={4}>
          {godMode ? '🔥 God Mode Komutlari' : 'Bir oneri secin veya yazin'}
        </Text>
      )}

      {/* Kategori chip'leri */}
      <ScrollArea type="never" offsetScrollbars={false}>
        <Group gap={6} wrap="nowrap" justify="center" px={compact ? 4 : 0}>
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <UnstyledButton
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: compact ? '4px 10px' : '6px 14px',
                  borderRadius: 20,
                  fontSize: compact ? 11 : 12,
                  fontWeight: isActive ? 600 : 500,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  background: isActive
                    ? godMode
                      ? isDark
                        ? 'rgba(255,71,87,0.2)'
                        : 'rgba(255,71,87,0.1)'
                      : isDark
                        ? 'rgba(139,92,246,0.2)'
                        : 'rgba(139,92,246,0.1)'
                    : isDark
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.04)',
                  color: isActive
                    ? godMode
                      ? isDark
                        ? '#ff6b81'
                        : '#ff4757'
                      : isDark
                        ? '#b794f4'
                        : '#7c3aed'
                    : isDark
                      ? 'rgba(255,255,255,0.6)'
                      : 'rgba(0,0,0,0.5)',
                  border: isActive
                    ? godMode
                      ? '1px solid rgba(255,71,87,0.3)'
                      : '1px solid rgba(139,92,246,0.3)'
                    : '1px solid transparent',
                }}
              >
                {cat.icon} {cat.label}
              </UnstyledButton>
            );
          })}
        </Group>
      </ScrollArea>

      {/* Prompt kartlari */}
      {compact ? (
        /* Compact: dikey liste */
        <Stack gap={4} px={2}>
          {visible.map((item) => (
            <SuggestionCard
              key={item.prompt}
              item={item}
              compact
              isDark={isDark}
              godMode={godMode}
              onSelect={onSelect}
            />
          ))}
        </Stack>
      ) : (
        /* Full: 2 kolonlu grid */
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs" maw={600} mx="auto" w="100%">
          {visible.map((item) => (
            <SuggestionCard
              key={item.prompt}
              item={item}
              compact={false}
              isDark={isDark}
              godMode={godMode}
              onSelect={onSelect}
            />
          ))}
        </SimpleGrid>
      )}

      {/* Bos durum */}
      {visible.length === 0 && (
        <Text size="xs" c="dimmed" ta="center" py="sm">
          Bu kategoride oneri bulunamadi
        </Text>
      )}
    </Stack>
  );
}

// --- Kart Componenti ---

function SuggestionCard({
  item,
  compact,
  isDark,
  godMode,
  onSelect,
}: {
  item: PromptSuggestion;
  compact: boolean;
  isDark: boolean;
  godMode?: boolean;
  onSelect: (prompt: string) => void;
}) {
  return (
    <Paper
      p={compact ? 'xs' : 'sm'}
      radius={compact ? 'md' : 'lg'}
      style={{
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        border: `1px solid ${
          godMode
            ? isDark
              ? 'rgba(255,71,87,0.15)'
              : 'rgba(255,71,87,0.1)'
            : isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.06)'
        }`,
        background: godMode
          ? isDark
            ? 'rgba(255,71,87,0.04)'
            : 'rgba(255,71,87,0.02)'
          : isDark
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(0,0,0,0.01)',
      }}
      onClick={() => onSelect(item.prompt)}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = godMode
          ? isDark
            ? 'rgba(255,71,87,0.1)'
            : 'rgba(255,71,87,0.06)'
          : isDark
            ? 'rgba(139,92,246,0.08)'
            : 'rgba(139,92,246,0.05)';
        el.style.borderColor = godMode
          ? 'rgba(255,71,87,0.3)'
          : isDark
            ? 'rgba(139,92,246,0.3)'
            : 'rgba(139,92,246,0.2)';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = godMode
          ? isDark
            ? 'rgba(255,71,87,0.04)'
            : 'rgba(255,71,87,0.02)'
          : isDark
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(0,0,0,0.01)';
        el.style.borderColor = godMode
          ? isDark
            ? 'rgba(255,71,87,0.15)'
            : 'rgba(255,71,87,0.1)'
          : isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.06)';
        el.style.transform = 'translateY(0)';
      }}
    >
      <Group gap={compact ? 8 : 'sm'} wrap="nowrap">
        <Text size={compact ? 'sm' : 'md'} style={{ lineHeight: 1, flexShrink: 0 }}>
          {item.icon}
        </Text>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size={compact ? 'xs' : 'sm'} fw={600} truncate c={godMode ? (isDark ? 'red.4' : 'red.7') : undefined}>
            {item.title}
          </Text>
          {!compact && (
            <Text size="xs" c="dimmed" lineClamp={1} mt={2}>
              {item.prompt}
            </Text>
          )}
        </Box>
        <IconArrowRight
          size={compact ? 12 : 14}
          style={{
            opacity: 0.3,
            flexShrink: 0,
            color: godMode ? '#ff4757' : undefined,
          }}
        />
      </Group>
    </Paper>
  );
}
