'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconCheck,
  IconEye,
  IconId,
  IconMail,
  IconMapPin,
  IconPhone,
  IconSignature,
  IconSparkles,
  IconUser,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/api';
import { API_BASE_URL } from '@/lib/config';
import type { BelgeAnalysisResult, FirmaBilgileri } from './types';
import { belgeTipleri, emptyFirma } from './types';

interface FirmaFormModalProps {
  opened: boolean;
  onClose: () => void;
  firma: FirmaBilgileri | null;
  firmaCount: number;
  onSaved: () => void;
}

export default function FirmaFormModal({
  opened,
  onClose,
  firma,
  firmaCount,
  onSaved,
}: FirmaFormModalProps) {
  const [formData, setFormData] = useState<Partial<FirmaBilgileri>>(emptyFirma);
  const [saving, setSaving] = useState(false);
  const [analyzingBelge, setAnalyzingBelge] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<BelgeAnalysisResult | null>(null);

  // Belge yükleme
  const [belgeModalOpened, { open: openBelgeModal, close: closeBelgeModal }] = useDisclosure(false);
  const [selectedBelgeTipi, setSelectedBelgeTipi] = useState<string>('');
  const [uploadingBelge, setUploadingBelge] = useState(false);

  // Firma değiştiğinde formu güncelle
  useEffect(() => {
    if (opened) {
      if (firma) {
        setFormData({ ...firma });
      } else {
        setFormData({ ...emptyFirma, varsayilan: firmaCount === 0 });
      }
      setLastAnalysis(null);
    }
  }, [opened, firma, firmaCount]);

  const handleSave = async () => {
    if (!formData.unvan?.trim()) {
      notifications.show({ title: 'Hata', message: 'Firma ünvanı zorunludur', color: 'red' });
      return;
    }

    setSaving(true);
    try {
      const url = firma
        ? `${API_BASE_URL}/api/firmalar/${firma.id}`
        : `${API_BASE_URL}/api/firmalar`;

      const res = await authFetch(url, {
        method: firma ? 'PUT' : 'POST',
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        onSaved();
        onClose();
        notifications.show({
          title: 'Kaydedildi',
          message: firma ? 'Firma bilgileri güncellendi' : 'Yeni firma eklendi',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        const data = await res.json();
        throw new Error(data.error || 'İşlem başarısız');
      }
    } catch (err: unknown) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Firma kaydedilemedi',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBelgeAnaliz = async (file: File, belgeTipi: string) => {
    if (!file || !belgeTipi) return;

    setAnalyzingBelge(true);
    try {
      const fd = new FormData();
      fd.append('dosya', file);
      fd.append('belge_tipi', belgeTipi);

      const res = await authFetch(`${API_BASE_URL}/api/firmalar/analyze-belge`, {
        method: 'POST',
        body: fd,
      });

      if (res.ok) {
        const data = await res.json();
        setLastAnalysis(data);

        if (data.analiz?.success && data.analiz?.data) {
          const analizData = data.analiz.data;
          setFormData((prev) => ({
            ...prev,
            unvan: analizData.unvan || prev.unvan,
            vergi_dairesi: analizData.vergi_dairesi || prev.vergi_dairesi,
            vergi_no: analizData.vergi_no || prev.vergi_no,
            ticaret_sicil_no: analizData.ticaret_sicil_no || prev.ticaret_sicil_no,
            mersis_no: analizData.mersis_no || prev.mersis_no,
            adres: analizData.adres || prev.adres,
            il: analizData.il || prev.il,
            ilce: analizData.ilce || prev.ilce,
            telefon: analizData.telefon || prev.telefon,
            yetkili_adi: analizData.yetkili_adi || prev.yetkili_adi,
            yetkili_tc: analizData.yetkili_tc || prev.yetkili_tc,
            yetkili_unvani: analizData.yetkili_unvani || prev.yetkili_unvani,
            imza_yetkisi: analizData.imza_yetkisi || prev.imza_yetkisi,
          }));

          notifications.show({
            title: '✨ AI Analiz Tamamlandı',
            message: `${data.analiz.belgeTipiAd} analiz edildi. Form otomatik dolduruldu.`,
            color: 'green',
            autoClose: 5000,
          });
        } else {
          notifications.show({
            title: 'Analiz Tamamlandı',
            message: 'Belge okundu ancak bazı bilgiler çıkarılamadı. Manuel kontrol edin.',
            color: 'yellow',
          });
        }
      }
    } catch (_err) {
      notifications.show({ title: 'Hata', message: 'Belge analiz edilemedi', color: 'red' });
    } finally {
      setAnalyzingBelge(false);
    }
  };

  const handleBelgeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firma || !selectedBelgeTipi) return;

    setUploadingBelge(true);
    try {
      const fd = new FormData();
      fd.append('dosya', file);
      fd.append('belge_tipi', selectedBelgeTipi);
      fd.append('tarih', new Date().toISOString().split('T')[0]);

      const res = await authFetch(`${API_BASE_URL}/api/firmalar/${firma.id}/belge`, {
        method: 'POST',
        body: fd,
      });

      if (res.ok) {
        onSaved();
        closeBelgeModal();
        notifications.show({
          title: 'Yüklendi',
          message: 'Belge başarıyla yüklendi',
          color: 'green',
        });
      }
    } catch (_err) {
      notifications.show({ title: 'Hata', message: 'Belge yüklenemedi', color: 'red' });
    } finally {
      setUploadingBelge(false);
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="sm">
            <ThemeIcon size="md" radius="md" variant="light" color="teal">
              <IconBuilding size={16} />
            </ThemeIcon>
            <Text fw={600}>{firma ? 'Firma Düzenle' : 'Yeni Firma Ekle'}</Text>
          </Group>
        }
        size="xl"
        centered
      >
        <ScrollArea h={500} type="auto" offsetScrollbars>
          <Stack gap="md" pr="sm">
            {/* Belgeden Tanı - AI ile Otomatik Doldurma */}
            {!firma && (
              <Paper
                p="md"
                radius="md"
                withBorder
                style={{
                  background:
                    'linear-gradient(135deg, rgba(64,192,87,0.05) 0%, rgba(34,139,230,0.05) 100%)',
                }}
              >
                <Stack gap="sm">
                  <Group gap="xs">
                    <ThemeIcon size="sm" variant="light" color="green">
                      <IconSparkles size={14} />
                    </ThemeIcon>
                    <Text fw={600} size="sm">
                      🤖 Belgeden Tanı (AI)
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Vergi levhası, sicil gazetesi veya imza sirküleri yükleyin - AI bilgileri
                    otomatik çıkarsın.
                  </Text>
                  <SimpleGrid cols={{ base: 2, sm: 3 }}>
                    {belgeTipleri.slice(0, 3).map((belge) => (
                      <Paper
                        key={belge.value}
                        p="xs"
                        radius="md"
                        withBorder
                        style={{ cursor: 'pointer' }}
                      >
                        <Stack gap={4} align="center">
                          <Text size="xs" fw={500} ta="center">
                            {belge.label}
                          </Text>
                          <label style={{ cursor: 'pointer' }}>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleBelgeAnaliz(file, belge.value);
                              }}
                              disabled={analyzingBelge}
                            />
                            <Badge
                              size="xs"
                              variant="light"
                              color="blue"
                              style={{ cursor: 'pointer' }}
                            >
                              {analyzingBelge ? 'Analiz...' : '📄 Yükle'}
                            </Badge>
                          </label>
                        </Stack>
                      </Paper>
                    ))}
                  </SimpleGrid>
                  {analyzingBelge && (
                    <Group gap="xs">
                      <Loader size="xs" />
                      <Text size="xs" c="dimmed">
                        AI belgeyi analiz ediyor...
                      </Text>
                    </Group>
                  )}
                  {lastAnalysis?.analiz?.success && (
                    <Alert color="green" variant="light" p="xs">
                      <Text size="xs">
                        ✅ {lastAnalysis.analiz.belgeTipiAd} analiz edildi. Güven:{' '}
                        {Math.round((lastAnalysis.analiz.data?.guven_skoru || 0.85) * 100)}%
                      </Text>
                    </Alert>
                  )}
                </Stack>
              </Paper>
            )}

            <Divider label="veya manuel girin" labelPosition="center" />

            {/* Temel Bilgiler */}
            <Text fw={600} size="sm" c="dimmed">
              TEMEL BİLGİLER
            </Text>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Firma Ünvanı"
                placeholder="ABC Yemek Hizmetleri Ltd. Şti."
                value={formData.unvan || ''}
                onChange={(e) => setFormData({ ...formData, unvan: e.currentTarget.value })}
                leftSection={<IconBuilding size={16} />}
                required
              />
              <TextInput
                label="Kısa Ad"
                placeholder="ABC Yemek"
                value={formData.kisa_ad || ''}
                onChange={(e) => setFormData({ ...formData, kisa_ad: e.currentTarget.value })}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput
                label="Vergi Dairesi"
                placeholder="Ankara Kurumlar"
                value={formData.vergi_dairesi || ''}
                onChange={(e) => setFormData({ ...formData, vergi_dairesi: e.currentTarget.value })}
                leftSection={<IconId size={16} />}
              />
              <TextInput
                label="Vergi No"
                placeholder="1234567890"
                value={formData.vergi_no || ''}
                onChange={(e) => setFormData({ ...formData, vergi_no: e.currentTarget.value })}
                leftSection={<IconId size={16} />}
              />
              <TextInput
                label="MERSİS No"
                placeholder="0123456789012345"
                value={formData.mersis_no || ''}
                onChange={(e) => setFormData({ ...formData, mersis_no: e.currentTarget.value })}
              />
            </SimpleGrid>

            <TextInput
              label="Ticaret Sicil No"
              placeholder="123456"
              value={formData.ticaret_sicil_no || ''}
              onChange={(e) =>
                setFormData({ ...formData, ticaret_sicil_no: e.currentTarget.value })
              }
            />

            <Divider label="İletişim" labelPosition="center" />

            <TextInput
              label="Adres"
              placeholder="Firma adresi"
              value={formData.adres || ''}
              onChange={(e) => setFormData({ ...formData, adres: e.currentTarget.value })}
              leftSection={<IconMapPin size={16} />}
            />

            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput
                label="İl"
                placeholder="Ankara"
                value={formData.il || ''}
                onChange={(e) => setFormData({ ...formData, il: e.currentTarget.value })}
              />
              <TextInput
                label="İlçe"
                placeholder="Çankaya"
                value={formData.ilce || ''}
                onChange={(e) => setFormData({ ...formData, ilce: e.currentTarget.value })}
              />
              <TextInput
                label="Telefon"
                placeholder="0312 XXX XX XX"
                value={formData.telefon || ''}
                onChange={(e) => setFormData({ ...formData, telefon: e.currentTarget.value })}
                leftSection={<IconPhone size={16} />}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="E-posta"
                placeholder="info@firma.com.tr"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.currentTarget.value })}
                leftSection={<IconMail size={16} />}
              />
              <TextInput
                label="Web Sitesi"
                placeholder="www.firma.com.tr"
                value={formData.web_sitesi || ''}
                onChange={(e) => setFormData({ ...formData, web_sitesi: e.currentTarget.value })}
              />
            </SimpleGrid>

            <Divider label="Yetkili Bilgileri" labelPosition="center" />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Yetkili Adı Soyadı"
                placeholder="Ad Soyad"
                value={formData.yetkili_adi || ''}
                onChange={(e) => setFormData({ ...formData, yetkili_adi: e.currentTarget.value })}
                leftSection={<IconUser size={16} />}
              />
              <TextInput
                label="Yetkili Unvanı"
                placeholder="Şirket Müdürü"
                value={formData.yetkili_unvani || ''}
                onChange={(e) =>
                  setFormData({ ...formData, yetkili_unvani: e.currentTarget.value })
                }
                leftSection={<IconId size={16} />}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Yetkili TC Kimlik No"
                placeholder="12345678901"
                value={formData.yetkili_tc || ''}
                onChange={(e) => setFormData({ ...formData, yetkili_tc: e.currentTarget.value })}
              />
              <TextInput
                label="Yetkili Telefon"
                placeholder="0532 XXX XX XX"
                value={formData.yetkili_telefon || ''}
                onChange={(e) =>
                  setFormData({ ...formData, yetkili_telefon: e.currentTarget.value })
                }
              />
            </SimpleGrid>

            <TextInput
              label="İmza Yetkisi Açıklaması"
              placeholder="Şirketi her türlü konuda temsile yetkilidir"
              value={formData.imza_yetkisi || ''}
              onChange={(e) => setFormData({ ...formData, imza_yetkisi: e.currentTarget.value })}
              leftSection={<IconSignature size={16} />}
            />

            <Divider label="Banka Bilgileri" labelPosition="center" />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Banka Adı"
                placeholder="Ziraat Bankası"
                value={formData.banka_adi || ''}
                onChange={(e) => setFormData({ ...formData, banka_adi: e.currentTarget.value })}
              />
              <TextInput
                label="Şube"
                placeholder="Kızılay Şubesi"
                value={formData.banka_sube || ''}
                onChange={(e) => setFormData({ ...formData, banka_sube: e.currentTarget.value })}
              />
            </SimpleGrid>

            <TextInput
              label="IBAN"
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              value={formData.iban || ''}
              onChange={(e) => setFormData({ ...formData, iban: e.currentTarget.value })}
            />

            <Divider label="2. Yetkili Bilgileri (Opsiyonel)" labelPosition="center" />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="2. Yetkili Adı Soyadı"
                placeholder="Ad Soyad"
                value={formData.yetkili2_adi || ''}
                onChange={(e) => setFormData({ ...formData, yetkili2_adi: e.currentTarget.value })}
              />
              <TextInput
                label="2. Yetkili Unvanı"
                placeholder="Genel Müdür Yrd."
                value={formData.yetkili2_unvani || ''}
                onChange={(e) =>
                  setFormData({ ...formData, yetkili2_unvani: e.currentTarget.value })
                }
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="2. Yetkili TC"
                placeholder="12345678901"
                value={formData.yetkili2_tc || ''}
                onChange={(e) => setFormData({ ...formData, yetkili2_tc: e.currentTarget.value })}
              />
              <TextInput
                label="2. Yetkili Telefon"
                placeholder="0532 XXX XX XX"
                value={formData.yetkili2_telefon || ''}
                onChange={(e) =>
                  setFormData({ ...formData, yetkili2_telefon: e.currentTarget.value })
                }
              />
            </SimpleGrid>

            <Divider label="2. Banka Hesabı (Opsiyonel)" labelPosition="center" />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="2. Banka Adı"
                placeholder="İş Bankası"
                value={formData.banka2_adi || ''}
                onChange={(e) => setFormData({ ...formData, banka2_adi: e.currentTarget.value })}
              />
              <TextInput
                label="2. Şube"
                placeholder="Ulus Şubesi"
                value={formData.banka2_sube || ''}
                onChange={(e) => setFormData({ ...formData, banka2_sube: e.currentTarget.value })}
              />
            </SimpleGrid>

            <TextInput
              label="2. IBAN"
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              value={formData.banka2_iban || ''}
              onChange={(e) => setFormData({ ...formData, banka2_iban: e.currentTarget.value })}
            />

            <Divider label="SGK ve Resmi Bilgiler" labelPosition="center" />

            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <TextInput
                label="SGK Sicil No"
                placeholder="1234567890"
                value={formData.sgk_sicil_no || ''}
                onChange={(e) => setFormData({ ...formData, sgk_sicil_no: e.currentTarget.value })}
              />
              <TextInput
                label="KEP Adresi"
                placeholder="firma@hs01.kep.tr"
                value={formData.kep_adresi || ''}
                onChange={(e) => setFormData({ ...formData, kep_adresi: e.currentTarget.value })}
              />
              <TextInput
                label="NACE Kodu"
                placeholder="56.29.01"
                value={formData.nace_kodu || ''}
                onChange={(e) => setFormData({ ...formData, nace_kodu: e.currentTarget.value })}
              />
            </SimpleGrid>

            <Divider label="Kapasite Bilgileri" labelPosition="center" />

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Günlük Üretim Kapasitesi (Porsiyon)"
                placeholder="5000"
                type="number"
                value={formData.gunluk_uretim_kapasitesi || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gunluk_uretim_kapasitesi: parseInt(e.currentTarget.value, 10) || undefined,
                  })
                }
              />
              <TextInput
                label="Personel Kapasitesi"
                placeholder="50"
                type="number"
                value={formData.personel_kapasitesi || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    personel_kapasitesi: parseInt(e.currentTarget.value, 10) || undefined,
                  })
                }
              />
            </SimpleGrid>

            {/* Belgeler - Sadece düzenleme modunda */}
            {firma && (
              <>
                <Divider label="Belgeler" labelPosition="center" />
                <SimpleGrid cols={{ base: 2, sm: 3 }}>
                  {belgeTipleri.map((belge) => {
                    const urlKey = `${belge.value}_url` as keyof FirmaBilgileri;
                    const hasFile = firma[urlKey];
                    return (
                      <Paper key={belge.value} p="sm" radius="md" withBorder>
                        <Stack gap="xs">
                          <Text size="xs" fw={500}>
                            {belge.label}
                          </Text>
                          {hasFile ? (
                            <Group gap="xs">
                              <Badge size="xs" color="green" variant="light">
                                Yüklü
                              </Badge>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                component="a"
                                href={`${API_BASE_URL}${hasFile}`}
                                target="_blank"
                              >
                                <IconEye size={12} />
                              </ActionIcon>
                            </Group>
                          ) : (
                            <Button
                              size="xs"
                              variant="light"
                              onClick={() => {
                                setSelectedBelgeTipi(belge.value);
                                openBelgeModal();
                              }}
                            >
                              Yükle
                            </Button>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              </>
            )}

            <Divider />

            <Switch
              label="Varsayılan firma olarak ayarla"
              description="İhale Uzmanı sayfasında otomatik seçilir"
              checked={formData.varsayilan || false}
              onChange={(e) => setFormData({ ...formData, varsayilan: e.currentTarget.checked })}
              color="teal"
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={onClose}>
                İptal
              </Button>
              <Button
                color="teal"
                onClick={handleSave}
                loading={saving}
                leftSection={<IconCheck size={16} />}
              >
                {firma ? 'Güncelle' : 'Ekle'}
              </Button>
            </Group>
          </Stack>
        </ScrollArea>
      </Modal>

      {/* Belge Yükleme Modalı */}
      <Modal
        opened={belgeModalOpened}
        onClose={closeBelgeModal}
        title="Belge Yükle"
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            <strong>{belgeTipleri.find((b) => b.value === selectedBelgeTipi)?.label}</strong>{' '}
            yükleyin
          </Text>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleBelgeUpload}
            disabled={uploadingBelge}
          />
          {uploadingBelge && (
            <Text size="xs" c="dimmed">
              Yükleniyor...
            </Text>
          )}
        </Stack>
      </Modal>
    </>
  );
}
