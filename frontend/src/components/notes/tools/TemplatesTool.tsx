'use client';

/**
 * TemplatesTool - Hazir not sablonlari
 * Tikla → yeni not olustur, icerigi doldur
 */

import {
  Badge,
  Box,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconBriefcase,
  IconCalendar,
  IconChecklist,
  IconClipboardList,
  IconCooker,
  IconTemplate,
  IconTruck,
  IconUsers,
} from '@tabler/icons-react';

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  title: string;
  content: string;
  isTask: boolean;
  tags: string[];
}

const TEMPLATES: NoteTemplate[] = [
  {
    id: 'toplanti',
    name: 'Toplanti Notu',
    description: 'Gundem, katilimcilar, kararlar',
    icon: <IconUsers size={20} />,
    color: 'blue',
    title: 'Toplanti Notu',
    content: `<h2>Toplanti Detaylari</h2>
<p><strong>Tarih:</strong> </p>
<p><strong>Katilimcilar:</strong> </p>
<p><strong>Yer:</strong> </p>
<h2>Gundem</h2>
<ul><li>Madde 1</li><li>Madde 2</li><li>Madde 3</li></ul>
<h2>Alinan Kararlar</h2>
<ul><li></li></ul>
<h2>Aksiyon Maddeleri</h2>
<ul><li><strong>Sorumlu:</strong> — Tarih: </li></ul>`,
    isTask: false,
    tags: ['toplanti'],
  },
  {
    id: 'ihale-degerlendirme',
    name: 'Ihale Degerlendirme',
    description: 'Firma, fiyat, avantaj/dezavantaj',
    icon: <IconBriefcase size={20} />,
    color: 'violet',
    title: 'Ihale Degerlendirme',
    content: `<h2>Ihale Bilgileri</h2>
<p><strong>Ihale adi:</strong> </p>
<p><strong>Kurum:</strong> </p>
<p><strong>Son teklif tarihi:</strong> </p>
<p><strong>Tahmini bedel:</strong> </p>
<h2>Degerlendirme</h2>
<p><strong>Avantajlar:</strong></p>
<ul><li></li></ul>
<p><strong>Dezavantajlar / Riskler:</strong></p>
<ul><li></li></ul>
<h2>Maliyet Tahmini</h2>
<p><strong>Malzeme:</strong> TL</p>
<p><strong>Iscilik:</strong> TL</p>
<p><strong>Diger:</strong> TL</p>
<p><strong>Toplam:</strong> TL</p>
<h2>Karar</h2>
<p>Teklif verilsin mi: Evet / Hayir</p>
<p>Notlar: </p>`,
    isTask: false,
    tags: ['ihale'],
  },
  {
    id: 'haftalik-plan',
    name: 'Haftalik Plan',
    description: 'Haftalik gorev ve hedefler',
    icon: <IconCalendar size={20} />,
    color: 'teal',
    title: 'Haftalik Plan',
    content: `<h2>Bu Hafta Hedefleri</h2>
<ul><li></li></ul>
<h2>Pazartesi</h2>
<ul><li></li></ul>
<h2>Sali</h2>
<ul><li></li></ul>
<h2>Carsamba</h2>
<ul><li></li></ul>
<h2>Persembe</h2>
<ul><li></li></ul>
<h2>Cuma</h2>
<ul><li></li></ul>
<h2>Notlar</h2>
<p></p>`,
    isTask: true,
    tags: ['plan', 'haftalik'],
  },
  {
    id: 'tedarikci-gorusmesi',
    name: 'Tedarikci Gorusmesi',
    description: 'Firma, urun, fiyat, vade',
    icon: <IconTruck size={20} />,
    color: 'orange',
    title: 'Tedarikci Gorusmesi',
    content: `<h2>Tedarikci Bilgileri</h2>
<p><strong>Firma:</strong> </p>
<p><strong>Yetkili:</strong> </p>
<p><strong>Telefon:</strong> </p>
<p><strong>Gorusme tarihi:</strong> </p>
<h2>Gorusulen Urunler</h2>
<ul><li><strong>Urun:</strong>  — Fiyat:  TL/kg</li></ul>
<h2>Vade / Odeme Kosullari</h2>
<p></p>
<h2>Sonraki Adimlar</h2>
<ul><li></li></ul>`,
    isTask: false,
    tags: ['tedarikci'],
  },
  {
    id: 'mutfak-rapor',
    name: 'Gunluk Mutfak Raporu',
    description: 'Menu, porsiyon, fire, stok',
    icon: <IconCooker size={20} />,
    color: 'red',
    title: 'Gunluk Mutfak Raporu',
    content: `<h2>Tarih: </h2>
<h2>Servis Edilen Menu</h2>
<ul><li><strong>Oglen:</strong> </li><li><strong>Aksam:</strong> </li></ul>
<h2>Porsiyon Sayilari</h2>
<p><strong>Planlanan:</strong> </p>
<p><strong>Uretilen:</strong> </p>
<p><strong>Servis edilen:</strong> </p>
<h2>Fire / Israf</h2>
<p></p>
<h2>Stok Durum</h2>
<p><strong>Kritik azalanlar:</strong></p>
<ul><li></li></ul>
<h2>Notlar</h2>
<p></p>`,
    isTask: false,
    tags: ['mutfak', 'rapor'],
  },
  {
    id: 'maliyet-analizi',
    name: 'Maliyet Analizi',
    description: 'Urun, birim fiyat, kar marji',
    icon: <IconClipboardList size={20} />,
    color: 'cyan',
    title: 'Maliyet Analizi',
    content: `<h2>Analiz Basligi</h2>
<p><strong>Tarih:</strong> </p>
<p><strong>Donem:</strong> </p>
<h2>Maliyet Kalemleri</h2>
<ul>
<li><strong>Hammadde:</strong>  TL</li>
<li><strong>Iscilik:</strong>  TL</li>
<li><strong>Enerji:</strong>  TL</li>
<li><strong>Lojistik:</strong>  TL</li>
<li><strong>Diger:</strong>  TL</li>
</ul>
<h2>Toplam Maliyet:</h2>
<p><strong> TL</strong></p>
<h2>Gelir ve Kar Marji</h2>
<p><strong>Gelir:</strong>  TL</p>
<p><strong>Kar:</strong>  TL</p>
<p><strong>Kar marji:</strong> %</p>
<h2>Degerlendirme</h2>
<p></p>`,
    isTask: false,
    tags: ['maliyet'],
  },
  {
    id: 'kontrol-listesi',
    name: 'Kontrol Listesi',
    description: 'Genel amacli checklist',
    icon: <IconChecklist size={20} />,
    color: 'green',
    title: 'Kontrol Listesi',
    content: `<h2>Kontrol Listesi</h2>
<p><strong>Konu:</strong> </p>
<p><strong>Tarih:</strong> </p>`,
    isTask: true,
    tags: ['kontrol'],
  },
];

interface TemplatesToolProps {
  onSelectTemplate: (template: NoteTemplate) => void;
}

export function TemplatesTool({ onSelectTemplate }: TemplatesToolProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack gap="md">
      <Group gap="sm">
        <IconTemplate size={20} />
        <Text size="lg" fw={700}>
          Sablonlar
        </Text>
      </Group>
      <Text size="xs" c="dimmed">
        Hazir bir sablon secerek hizlica not olusturun.
      </Text>

      <SimpleGrid cols={2} spacing="sm">
        {TEMPLATES.map((tpl) => (
          <Paper
            key={tpl.id}
            p="md"
            radius="md"
            withBorder
            style={{
              cursor: 'pointer',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              transition: 'all 0.15s ease',
            }}
            onClick={() => onSelectTemplate(tpl)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `var(--mantine-color-${tpl.color}-5)`;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Stack gap="xs">
              <Group gap="sm">
                <Box
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `var(--mantine-color-${tpl.color}-${isDark ? '9' : '0'})`,
                    color: `var(--mantine-color-${tpl.color}-${isDark ? '4' : '6'})`,
                  }}
                >
                  {tpl.icon}
                </Box>
                {tpl.isTask && (
                  <Badge size="xs" variant="light" color="orange">
                    Gorev
                  </Badge>
                )}
              </Group>
              <Text size="sm" fw={600}>
                {tpl.name}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2}>
                {tpl.description}
              </Text>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

export { TEMPLATES };
