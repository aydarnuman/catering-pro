'use client';

import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconChevronDown,
  IconDownload,
  IconEye,
  IconFileAnalytics,
  IconFileText,
  IconFolder,
  IconInfoCircle,
  IconReload,
  IconSparkles,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/api';
import AIDataSelector from './AIDataSelector';
import type { AIAnalysisResult, FirmaBilgileri, FirmaDokuman } from './types';
import { belgeKategorileri, belgeTipleriListe } from './types';

interface DokumanYonetimiProps {
  varsayilanFirma: FirmaBilgileri | undefined;
  API_BASE_URL: string;
}

export default function DokumanYonetimi({ varsayilanFirma, API_BASE_URL }: DokumanYonetimiProps) {
  const [dokumanlar, setDokumanlar] = useState<FirmaDokuman[]>([]);
  const [loadingDokumanlar, setLoadingDokumanlar] = useState(false);
  const [dokumanModalOpened, { open: openDokumanModal, close: closeDokumanModal }] = useDisclosure(false);
  const [uploadingDokuman, setUploadingDokuman] = useState(false);
  const [selectedBelgeTipi, setSelectedBelgeTipi] = useState('auto');
  const [selectedBelgeKategori, setSelectedBelgeKategori] = useState('kurumsal');
  const [lastAIAnalysis, setLastAIAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiApplyModalOpened, { open: openAIApplyModal, close: closeAIApplyModal }] = useDisclosure(false);
  const [selectedDokumanForApply, setSelectedDokumanForApply] = useState<FirmaDokuman | null>(null);
  const [expandedDocCategories, setExpandedDocCategories] = useState<string[]>(['kurumsal']);

  const fetchDokumanlar = useCallback(async () => {
    if (!varsayilanFirma?.id) return;
    try {
      setLoadingDokumanlar(true);
      const res = await authFetch(`${API_BASE_URL}/api/firmalar/${varsayilanFirma.id}/dokumanlar`);
      if (res.ok) {
        const data = await res.json();
        setDokumanlar(data.data || []);
      }
    } catch (err) {
      console.error('Dökümanlar yüklenemedi:', err);
    } finally {
      setLoadingDokumanlar(false);
    }
  }, [varsayilanFirma?.id, API_BASE_URL]);

  useEffect(() => {
    if (varsayilanFirma?.id) fetchDokumanlar();
  }, [varsayilanFirma?.id, fetchDokumanlar]);

  // ─── Handlers ────────────────────────────────────────
  const handleDokumanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !varsayilanFirma?.id || !selectedBelgeTipi) return;

    try {
      setUploadingDokuman(true);
      const formData = new FormData();
      formData.append('dosya', file);
      formData.append('belge_tipi', selectedBelgeTipi);
      formData.append('belge_kategori', selectedBelgeKategori);
      formData.append('auto_fill', 'false');

      const res = await authFetch(`${API_BASE_URL}/api/firmalar/${varsayilanFirma.id}/dokumanlar`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: '✅ Döküman Yüklendi',
          message: data.analiz?.success
            ? 'AI analizi tamamlandı. Verileri firmaya uygulamak ister misiniz?'
            : 'Döküman başarıyla kaydedildi',
          color: 'green',
        });

        if (data.analiz?.success && data.data) {
          setLastAIAnalysis(data.analiz);
          setSelectedDokumanForApply(data.data);
          openAIApplyModal();
        }

        fetchDokumanlar();
        closeDokumanModal();
      } else {
        notifications.show({ title: 'Hata', message: data.error, color: 'red' });
      }
    } catch (_err) {
      notifications.show({ title: 'Hata', message: 'Döküman yüklenemedi', color: 'red' });
    } finally {
      setUploadingDokuman(false);
      setSelectedBelgeTipi('');
    }
  };

  const handleApplyAIData = async (secilenAlanlar: string[]) => {
    if (!varsayilanFirma?.id || !selectedDokumanForApply) return;

    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/firmalar/${varsayilanFirma.id}/dokumanlar/${selectedDokumanForApply.id}/veriyi-uygula`,
        {
          method: 'POST',
          body: JSON.stringify({ secilenAlanlar }),
        }
      );

      const data = await res.json();

      if (data.success) {
        notifications.show({
          title: '✅ Veriler Uygulandı',
          message: `${data.uygulaananAlanlar?.length || 0} alan firmaya başarıyla aktarıldı`,
          color: 'green',
        });
        closeAIApplyModal();
        window.location.reload();
      } else {
        notifications.show({ title: 'Hata', message: data.error, color: 'red' });
      }
    } catch (_err) {
      notifications.show({ title: 'Hata', message: 'Veriler uygulanamadı', color: 'red' });
    }
  };

  const handleDeleteDokuman = async (dokumanId: number) => {
    if (!varsayilanFirma?.id) return;
    if (!confirm('Bu dökümanı silmek istediğinize emin misiniz?')) return;

    try {
      const res = await authFetch(`${API_BASE_URL}/api/firmalar/${varsayilanFirma.id}/dokumanlar/${dokumanId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        notifications.show({ title: 'Silindi', message: 'Döküman silindi', color: 'green' });
        fetchDokumanlar();
      } else {
        notifications.show({ title: 'Hata', message: data.error, color: 'red' });
      }
    } catch (_err) {
      notifications.show({ title: 'Hata', message: 'Döküman silinemedi', color: 'red' });
    }
  };

  const handleReanalyze = async (dokuman: FirmaDokuman) => {
    if (!varsayilanFirma?.id) return;

    try {
      notifications.show({
        title: 'Analiz Ediliyor...',
        message: 'Lütfen bekleyin',
        color: 'blue',
        loading: true,
        id: 'reanalyze',
      });

      const res = await authFetch(
        `${API_BASE_URL}/api/firmalar/${varsayilanFirma.id}/dokumanlar/${dokuman.id}/yeniden-analiz`,
        {
          method: 'POST',
          body: JSON.stringify({ auto_fill: 'false' }),
        }
      );

      const data = await res.json();
      notifications.hide('reanalyze');

      if (data.success && data.analiz?.success) {
        notifications.show({
          title: '✅ Analiz Tamamlandı',
          message: 'Verileri firmaya uygulamak ister misiniz?',
          color: 'green',
        });
        setLastAIAnalysis(data.analiz);
        setSelectedDokumanForApply({ ...dokuman, ai_cikartilan_veriler: data.analiz.data });
        openAIApplyModal();
        fetchDokumanlar();
      } else {
        notifications.show({
          title: 'Hata',
          message: data.message || 'Analiz başarısız',
          color: 'red',
        });
      }
    } catch (_err) {
      notifications.hide('reanalyze');
      notifications.show({ title: 'Hata', message: 'Yeniden analiz yapılamadı', color: 'red' });
    }
  };

  const handleReanalyzeAll = async () => {
    if (!varsayilanFirma?.id || dokumanlar.length === 0) return;

    const confirmed = window.confirm(
      `${dokumanlar.length} döküman yeniden analiz edilecek. Devam etmek istiyor musunuz?`
    );
    if (!confirmed) return;

    notifications.show({
      title: '🔄 Toplu Analiz Başladı',
      message: `${dokumanlar.length} döküman analiz ediliyor...`,
      color: 'blue',
      loading: true,
      id: 'bulk-reanalyze',
      autoClose: false,
    });

    let success = 0;
    let failed = 0;

    for (const doc of dokumanlar) {
      try {
        const res = await authFetch(
          `${API_BASE_URL}/api/firmalar/${varsayilanFirma.id}/dokumanlar/${doc.id}/yeniden-analiz`,
          {
            method: 'POST',
            body: JSON.stringify({ auto_fill: 'false' }),
          }
        );
        const data = await res.json();
        if (data.success) success++;
        else failed++;
      } catch {
        failed++;
      }
    }

    notifications.hide('bulk-reanalyze');
    notifications.show({
      title: '✅ Toplu Analiz Tamamlandı',
      message: `${success} başarılı, ${failed} başarısız`,
      color: failed > 0 ? 'yellow' : 'green',
    });
    fetchDokumanlar();
  };

  const handleDownloadAllDocs = () => {
    if (!varsayilanFirma?.id) return;
    window.open(`${API_BASE_URL}/api/firmalar/${varsayilanFirma.id}/dokumanlar-zip`, '_blank');
  };

  const handleExportFirma = () => {
    if (!varsayilanFirma?.id) return;
    window.open(`${API_BASE_URL}/api/firmalar/${varsayilanFirma.id}/export?format=excel`, '_blank');
  };

  // ─── Render ──────────────────────────────────────────
  return (
    <div>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={4}>📁 Döküman Yönetimi</Title>
          <Text size="sm" c="dimmed">
            Firma belgelerini yükleyin, AI ile analiz edin ve otomatik doldurun
          </Text>
        </div>
        <Group gap="xs">
          {dokumanlar.length > 0 && (
            <>
              <Tooltip label="Tümünü ZIP İndir">
                <ActionIcon variant="light" color="blue" onClick={handleDownloadAllDocs}>
                  <IconDownload size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Firma Bilgilerini Excel'e Aktar">
                <ActionIcon variant="light" color="green" onClick={handleExportFirma}>
                  <IconFileAnalytics size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Tüm Dökümanları Yeniden Analiz Et">
                <ActionIcon variant="light" color="violet" onClick={handleReanalyzeAll}>
                  <IconSparkles size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
          <Button
            leftSection={<IconUpload size={16} />}
            onClick={openDokumanModal}
            color="indigo"
            variant="light"
            size="sm"
            disabled={!varsayilanFirma}
          >
            Döküman Yükle
          </Button>
        </Group>
      </Group>

      {!varsayilanFirma ? (
        <Paper p="lg" radius="md" withBorder ta="center">
          <IconFolder size={48} color="var(--mantine-color-gray-5)" style={{ marginBottom: 16 }} />
          <Text c="dimmed">Döküman yüklemek için önce firma bilgilerini ekleyin</Text>
        </Paper>
      ) : loadingDokumanlar ? (
        <Skeleton height={150} radius="md" />
      ) : dokumanlar.length === 0 ? (
        <Paper p="lg" radius="md" withBorder ta="center">
          <IconFileText size={48} color="var(--mantine-color-gray-5)" style={{ marginBottom: 16 }} />
          <Text c="dimmed" mb="md">
            Henüz döküman yüklenmemiş
          </Text>
          <Text size="xs" c="dimmed" mb="md">
            Vergi levhası, sicil gazetesi gibi dökümanları yükleyin,
            <br />
            AI otomatik olarak firma bilgilerini çıkarsın
          </Text>
          <Button
            onClick={openDokumanModal}
            variant="light"
            color="indigo"
            size="sm"
            leftSection={<IconUpload size={14} />}
          >
            İlk Dökümanı Yükle
          </Button>
        </Paper>
      ) : (
        <Stack gap="md">
          {/* Kategori kartları */}
          <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
            {Object.entries(belgeKategorileri)
              .filter(([key]) => key !== 'all')
              .map(([key, val]) => {
                const count = dokumanlar.filter((d) => d.belge_kategori === key).length;
                const KatIcon = val.icon;
                return (
                  <Paper
                    key={key}
                    p="sm"
                    radius="md"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      borderColor: expandedDocCategories.includes(key)
                        ? `var(--mantine-color-${val.color}-5)`
                        : undefined,
                      background: expandedDocCategories.includes(key)
                        ? `var(--mantine-color-${val.color}-light)`
                        : undefined,
                    }}
                    onClick={() => {
                      setExpandedDocCategories((prev) =>
                        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
                      );
                    }}
                  >
                    <Group gap="xs">
                      <ThemeIcon size="sm" radius="md" variant="light" color={val.color}>
                        <KatIcon size={14} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">
                          {val.label}
                        </Text>
                        <Text size="sm" fw={600}>
                          {count}
                        </Text>
                      </div>
                      <ActionIcon size="xs" variant="subtle" ml="auto">
                        <IconChevronDown
                          size={12}
                          style={{
                            transform: expandedDocCategories.includes(key) ? 'rotate(180deg)' : 'rotate(0)',
                            transition: 'transform 0.2s',
                          }}
                        />
                      </ActionIcon>
                    </Group>
                  </Paper>
                );
              })}
          </SimpleGrid>

          {/* Accordion */}
          <Accordion
            variant="separated"
            radius="md"
            value={expandedDocCategories}
            onChange={(val) => setExpandedDocCategories(Array.isArray(val) ? val : val ? [val] : [])}
            multiple
          >
            {Object.entries(belgeKategorileri)
              .filter(([key]) => key !== 'all')
              .map(([key, val]) => {
                const kategoriDokumanlar = dokumanlar.filter((d) => d.belge_kategori === key);
                const KatIcon = val.icon;

                if (kategoriDokumanlar.length === 0) return null;

                return (
                  <Accordion.Item key={key} value={key}>
                    <Accordion.Control>
                      <Group gap="sm" style={{ flex: 1 }}>
                        <ThemeIcon size="sm" variant="light" color={val.color}>
                          <KatIcon size={14} />
                        </ThemeIcon>
                        <Text fw={500}>{val.label}</Text>
                        <Badge size="sm" variant="light" color={val.color}>
                          {kategoriDokumanlar.length}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="xs" mt="xs">
                        {kategoriDokumanlar.map((doc) => {
                          const belgeTip = belgeTipleriListe.find((b) => b.value === doc.belge_tipi);
                          const kategori = belgeKategorileri[doc.belge_kategori as keyof typeof belgeKategorileri];
                          const DocKatIcon = kategori?.icon || IconFileText;

                          return (
                            <Paper key={doc.id} p="sm" radius="md" withBorder>
                              <Group justify="space-between" wrap="nowrap">
                                <Group gap="sm" style={{ flex: 1, minWidth: 0 }}>
                                  <ThemeIcon size="md" radius="md" variant="light" color={kategori?.color || 'gray'}>
                                    <DocKatIcon size={16} />
                                  </ThemeIcon>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <Text fw={500} size="sm" truncate>
                                      {belgeTip?.label || doc.belge_tipi}
                                    </Text>
                                    <Text size="xs" c="dimmed" truncate>
                                      {doc.dosya_adi}
                                    </Text>
                                  </div>
                                </Group>

                                <Group gap="xs" wrap="nowrap">
                                  {doc.ai_analiz_yapildi && (
                                    <Tooltip label={`AI Güven: %${Math.round((doc.ai_guven_skoru || 0) * 100)}`}>
                                      <Badge
                                        size="xs"
                                        variant="light"
                                        color="violet"
                                        leftSection={<IconSparkles size={10} />}
                                      >
                                        AI
                                      </Badge>
                                    </Tooltip>
                                  )}

                                  {doc.gecerlilik_tarihi && (
                                    <Badge
                                      size="xs"
                                      variant="light"
                                      color={new Date(doc.gecerlilik_tarihi) < new Date() ? 'red' : 'green'}
                                    >
                                      {new Date(doc.gecerlilik_tarihi).toLocaleDateString('tr-TR')}
                                    </Badge>
                                  )}

                                  <Tooltip label="Görüntüle">
                                    <ActionIcon
                                      variant="subtle"
                                      color="blue"
                                      size="sm"
                                      onClick={() => window.open(`${API_BASE_URL}${doc.dosya_url}`, '_blank')}
                                    >
                                      <IconEye size={14} />
                                    </ActionIcon>
                                  </Tooltip>

                                  {doc.ai_analiz_yapildi &&
                                    doc.ai_cikartilan_veriler &&
                                    Object.keys(doc.ai_cikartilan_veriler).length > 0 && (
                                      <Tooltip label="AI Verisini Uygula">
                                        <ActionIcon
                                          variant="subtle"
                                          color="violet"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedDokumanForApply(doc);
                                            setLastAIAnalysis({
                                              data: doc.ai_cikartilan_veriler,
                                            });
                                            openAIApplyModal();
                                          }}
                                        >
                                          <IconSparkles size={14} />
                                        </ActionIcon>
                                      </Tooltip>
                                    )}

                                  <Tooltip label="Yeniden Analiz Et">
                                    <ActionIcon
                                      variant="subtle"
                                      color="cyan"
                                      size="sm"
                                      onClick={() => handleReanalyze(doc)}
                                    >
                                      <IconReload size={14} />
                                    </ActionIcon>
                                  </Tooltip>

                                  <Tooltip label="Sil">
                                    <ActionIcon
                                      variant="subtle"
                                      color="red"
                                      size="sm"
                                      onClick={() => handleDeleteDokuman(doc.id)}
                                    >
                                      <IconTrash size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Group>
                            </Paper>
                          );
                        })}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
          </Accordion>
        </Stack>
      )}

      {/* Döküman Yükleme Modal */}
      <Modal
        opened={dokumanModalOpened}
        onClose={closeDokumanModal}
        title={
          <Group gap="xs">
            <IconUpload size={20} />
            <Text fw={600}>Döküman Yükle</Text>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          <Alert icon={<IconSparkles size={16} />} color="violet" variant="light">
            <Text size="sm">
              Yüklediğiniz döküman AI tarafından analiz edilecek ve firma bilgileri otomatik olarak çıkarılacaktır.
            </Text>
          </Alert>

          <Select
            label="Belge Kategorisi"
            placeholder="Kategori seçin"
            data={Object.entries(belgeKategorileri).map(([key, val]) => ({
              value: key,
              label: val.label,
            }))}
            value={selectedBelgeKategori}
            onChange={(val) => {
              setSelectedBelgeKategori(val || 'kurumsal');
              setSelectedBelgeTipi('');
            }}
          />

          <Select
            label="Belge Tipi"
            placeholder="Belge tipini seçin"
            data={belgeTipleriListe
              .filter((b) => b.value === 'auto' || b.kategori === selectedBelgeKategori)
              .map((b) => ({ value: b.value, label: b.label }))}
            value={selectedBelgeTipi}
            onChange={(val) => setSelectedBelgeTipi(val || 'auto')}
            searchable
          />

          {selectedBelgeTipi && (
            <Paper p="md" radius="md" withBorder style={{ background: 'var(--mantine-color-gray-light)' }}>
              <Stack gap="sm">
                <Text size="sm" fw={500}>
                  📄 Dosya Seçin
                </Text>
                <Text size="xs" c="dimmed">
                  PDF, JPG, PNG, WEBP formatları desteklenir (max 10MB)
                </Text>

                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                  onChange={handleDokumanUpload}
                  disabled={uploadingDokuman}
                  style={{ display: 'none' }}
                  id="dokuman-upload-input"
                />
                <label htmlFor="dokuman-upload-input">
                  <Button
                    component="span"
                    leftSection={uploadingDokuman ? <Loader size={14} /> : <IconUpload size={16} />}
                    disabled={uploadingDokuman}
                    fullWidth
                    variant="filled"
                    color="indigo"
                  >
                    {uploadingDokuman ? 'Yükleniyor ve Analiz Ediliyor...' : 'Dosya Seç ve Yükle'}
                  </Button>
                </label>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Modal>

      {/* AI Veri Uygulama Modal */}
      <Modal
        opened={aiApplyModalOpened}
        onClose={closeAIApplyModal}
        title={
          <Group gap="xs">
            <IconSparkles size={20} color="var(--mantine-color-violet-6)" />
            <Text fw={600}>AI Analiz Sonuçları</Text>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          <Alert icon={<IconInfoCircle size={16} />} color="violet" variant="light">
            AI dökmandan aşağıdaki bilgileri çıkardı. Firmaya uygulamak istediğiniz alanları seçin.
          </Alert>

          {lastAIAnalysis?.data && (
            <AIDataSelector aiData={lastAIAnalysis.data} onApply={handleApplyAIData} onCancel={closeAIApplyModal} />
          )}
        </Stack>
      </Modal>
    </div>
  );
}
