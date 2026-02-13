'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconCheckbox,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconEye,
  IconMail,
  IconSearch,
  IconSquare,
  IconX,
  IconZip,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  downloadBlob,
  getFormatExtension,
  type ReportCatalog,
  type ReportDefinition,
  type ReportModule,
  type ReportRequest,
  reportsAPI,
} from '@/lib/api/services/reports';

interface RaporMerkeziModalProps {
  opened: boolean;
  onClose: () => void;
  module?: string;
  context?: Record<string, unknown>;
}

type FormatType = 'excel' | 'pdf';

interface PreviewData {
  type: 'pdf' | 'table';
  data: Blob | { headers: string[]; rows: Record<string, unknown>[] };
}

export default function RaporMerkeziModal({ opened, onClose, module, context = {} }: RaporMerkeziModalProps) {
  // State
  const [catalog, setCatalog] = useState<ReportCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [selectedFormats, setSelectedFormats] = useState<Map<string, FormatType>>(new Map());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [mailDialogOpen, setMailDialogOpen] = useState(false);
  const [mailEmail, setMailEmail] = useState('');
  const [mailSending, setMailSending] = useState(false);

  // Katalog yükle
  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    reportsAPI
      .getCatalog(module)
      .then((data) => {
        setCatalog(data);
        // İlk modülü aç
        if (data.modules.length > 0) {
          setExpandedModules(new Set(data.modules.map((m) => m.module)));
        }
      })
      .catch(() => {
        notifications.show({
          title: 'Hata',
          message: 'Rapor kataloğu yüklenemedi',
          color: 'red',
        });
      })
      .finally(() => setLoading(false));
  }, [opened, module]);

  // Reset on close
  useEffect(() => {
    if (!opened) {
      setSelectedReports(new Set());
      setSelectedFormats(new Map());
      setPreviewReportId(null);
      setPreviewData(null);
      setSearchQuery('');
      setMailDialogOpen(false);
    }
  }, [opened]);

  // Filtrelenmiş raporlar
  const filteredModules = useMemo(() => {
    if (!catalog) return [];
    if (!searchQuery.trim()) return catalog.modules;

    const q = searchQuery.toLowerCase();
    return catalog.modules
      .map((mod) => ({
        ...mod,
        reports: mod.reports.filter(
          (r) => r.label.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
        ),
      }))
      .filter((mod) => mod.reports.length > 0);
  }, [catalog, searchQuery]);

  // Toplam rapor sayısı
  const totalReports = useMemo(() => {
    return filteredModules.reduce((sum, m) => sum + m.reports.length, 0);
  }, [filteredModules]);

  // Tüm raporları seç/kaldır
  const toggleSelectAll = useCallback(() => {
    if (selectedReports.size === totalReports) {
      setSelectedReports(new Set());
    } else {
      const all = new Set<string>();
      for (const m of filteredModules) {
        for (const r of m.reports) {
          all.add(r.id);
        }
      }
      setSelectedReports(all);
    }
  }, [selectedReports.size, totalReports, filteredModules]);

  // Tek rapor seç/kaldır
  const toggleReport = useCallback((reportId: string) => {
    setSelectedReports((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  }, []);

  // Format seç
  const setFormat = useCallback((reportId: string, format: FormatType) => {
    setSelectedFormats((prev) => {
      const next = new Map(prev);
      next.set(reportId, format);
      return next;
    });
  }, []);

  // Rapor tanımını bul
  const findReport = useCallback(
    (id: string): ReportDefinition | undefined => {
      for (const mod of catalog?.modules || []) {
        const found = mod.reports.find((r) => r.id === id);
        if (found) return found;
      }
      return undefined;
    },
    [catalog]
  );

  // Rapor formatını al (default: ilk desteklenen)
  const getFormat = useCallback(
    (reportId: string): FormatType => {
      return selectedFormats.get(reportId) || findReport(reportId)?.formats[0] || 'pdf';
    },
    [selectedFormats, findReport]
  );

  // Ön gösterim yükle
  const loadPreview = useCallback(
    async (reportId: string) => {
      setPreviewReportId(reportId);
      setPreviewData(null);
      setPreviewLoading(true);

      try {
        const format = getFormat(reportId);
        const result = await reportsAPI.preview(reportId, format, context);
        setPreviewData(result);
      } catch {
        notifications.show({
          title: 'Ön Gösterim Hatası',
          message: 'Rapor ön gösterimi yüklenemedi',
          color: 'orange',
        });
      } finally {
        setPreviewLoading(false);
      }
    },
    [getFormat, context]
  );

  // Tek rapor indir
  const downloadSingle = useCallback(
    async (reportId: string) => {
      setDownloadingIds((prev) => new Set(prev).add(reportId));
      try {
        const format = getFormat(reportId);
        const blob = await reportsAPI.generate(reportId, format, context);
        const filename = `${reportId}-${new Date().toISOString().split('T')[0]}${getFormatExtension(format)}`;
        downloadBlob(blob, filename);
        notifications.show({
          title: 'İndirildi',
          message: filename,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } catch {
        notifications.show({
          title: 'Hata',
          message: 'Rapor indirilemedi',
          color: 'red',
        });
      } finally {
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(reportId);
          return next;
        });
      }
    },
    [getFormat, context]
  );

  // Toplu indirme (ZIP)
  const downloadBulk = useCallback(async () => {
    if (selectedReports.size === 0) return;
    setBulkDownloading(true);

    try {
      const reports: ReportRequest[] = Array.from(selectedReports).map((id) => ({
        reportId: id,
        format: getFormat(id),
        context,
      }));

      // Tek rapor seçiliyse direkt indir
      if (reports.length === 1) {
        await downloadSingle(reports[0].reportId);
        setBulkDownloading(false);
        return;
      }

      const blob = await reportsAPI.bulk(reports);
      const filename = `raporlar-${new Date().toISOString().split('T')[0]}.zip`;
      downloadBlob(blob, filename);

      notifications.show({
        title: 'Toplu İndirme',
        message: `${reports.length} rapor ZIP olarak indirildi`,
        color: 'green',
        icon: <IconZip size={16} />,
      });
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Toplu indirme başarısız',
        color: 'red',
      });
    } finally {
      setBulkDownloading(false);
    }
  }, [selectedReports, getFormat, context, downloadSingle]);

  // Mail gönder
  const sendMail = useCallback(async () => {
    if (!mailEmail || !mailEmail.includes('@')) {
      notifications.show({
        title: 'Hata',
        message: 'Geçerli bir e-posta adresi girin',
        color: 'red',
      });
      return;
    }

    setMailSending(true);
    try {
      const reports: ReportRequest[] = Array.from(selectedReports).map((id) => ({
        reportId: id,
        format: getFormat(id),
        context,
      }));

      const result = await reportsAPI.sendMail(reports, mailEmail);
      notifications.show({
        title: 'Gönderildi',
        message: result.message,
        color: 'green',
        icon: <IconMail size={16} />,
      });
      setMailDialogOpen(false);
      setMailEmail('');
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Mail gönderilemedi',
        color: 'red',
      });
    } finally {
      setMailSending(false);
    }
  }, [selectedReports, getFormat, context, mailEmail]);

  // Modül aç/kapa
  const toggleModule = useCallback((mod: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  }, []);

  // ─── Render ───

  const renderReportItem = (report: ReportDefinition) => {
    const isSelected = selectedReports.has(report.id);
    const isDownloading = downloadingIds.has(report.id);
    const isPreviewing = previewReportId === report.id;
    const format = getFormat(report.id);

    return (
      <Paper
        key={report.id}
        p="xs"
        withBorder={isPreviewing}
        style={{
          borderColor: isPreviewing ? 'var(--mantine-color-blue-5)' : undefined,
          backgroundColor: isPreviewing
            ? 'var(--mantine-color-blue-0)'
            : isSelected
              ? 'var(--mantine-color-gray-0)'
              : undefined,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <Group gap="xs" wrap="nowrap">
          <Checkbox checked={isSelected} onChange={() => toggleReport(report.id)} size="xs" />
          <Box style={{ flex: 1, minWidth: 0 }} onClick={() => loadPreview(report.id)}>
            <Text size="sm" fw={500} truncate="end">
              {report.label}
            </Text>
            <Text size="xs" c="dimmed" truncate="end">
              {report.description}
            </Text>
          </Box>

          <Group gap={4} wrap="nowrap">
            {/* Format toggle */}
            {report.formats.length > 1 && (
              <SegmentedControl
                size="xs"
                value={format}
                onChange={(val) => setFormat(report.id, val as FormatType)}
                data={report.formats.map((f) => ({
                  value: f,
                  label: f === 'excel' ? 'XLS' : 'PDF',
                }))}
                style={{ minWidth: 85 }}
              />
            )}
            {report.formats.length === 1 && (
              <Badge size="xs" variant="light" color={report.formats[0] === 'pdf' ? 'red' : 'green'}>
                {report.formats[0] === 'pdf' ? 'PDF' : 'XLS'}
              </Badge>
            )}

            {/* Ön gösterim */}
            <Tooltip label="Ön Gösterim">
              <ActionIcon
                size="sm"
                variant={isPreviewing ? 'filled' : 'subtle'}
                color="blue"
                onClick={() => loadPreview(report.id)}
              >
                <IconEye size={14} />
              </ActionIcon>
            </Tooltip>

            {/* Tek indir */}
            <Tooltip label="İndir">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="green"
                loading={isDownloading}
                onClick={() => downloadSingle(report.id)}
              >
                <IconDownload size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Paper>
    );
  };

  const renderModuleGroup = (mod: ReportModule) => {
    const isExpanded = expandedModules.has(mod.module);
    const selectedCount = mod.reports.filter((r) => selectedReports.has(r.id)).length;

    return (
      <Box key={mod.module}>
        <Group
          gap="xs"
          p="xs"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => toggleModule(mod.module)}
        >
          {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          <Text size="sm" fw={600} style={{ flex: 1 }}>
            {mod.label}
          </Text>
          <Badge size="xs" variant="light">
            {selectedCount > 0 ? `${selectedCount}/${mod.reports.length}` : mod.reports.length}
          </Badge>
        </Group>
        {isExpanded && (
          <Stack gap={4} ml="md" mr={4}>
            {mod.reports.map(renderReportItem)}
          </Stack>
        )}
      </Box>
    );
  };

  const renderPreviewPanel = () => {
    if (!previewReportId) {
      return (
        <Stack align="center" justify="center" h="100%" gap="xs">
          <IconEye size={48} color="var(--mantine-color-gray-4)" />
          <Text size="sm" c="dimmed" ta="center">
            Ön gösterim için bir rapor seçin
          </Text>
        </Stack>
      );
    }

    if (previewLoading) {
      return (
        <Stack align="center" justify="center" h="100%" gap="xs">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            Ön gösterim yükleniyor...
          </Text>
        </Stack>
      );
    }

    if (!previewData) {
      return (
        <Stack align="center" justify="center" h="100%" gap="xs">
          <Text size="sm" c="dimmed">
            Ön gösterim verisi bulunamadı
          </Text>
        </Stack>
      );
    }

    // PDF preview
    if (previewData.type === 'pdf') {
      const blob = previewData.data as Blob;
      const url = URL.createObjectURL(blob);
      return (
        <iframe
          src={url}
          title="PDF Ön Gösterim"
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }}
        />
      );
    }

    // Table preview
    const tableData = previewData.data as {
      headers: string[];
      rows: Record<string, unknown>[];
    };
    const displayRows = tableData.rows.slice(0, 50);

    return (
      <ScrollArea h="100%">
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              {tableData.headers.map((h) => (
                <Table.Th key={h} fz="xs">
                  {h}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {displayRows.map((row, idx) => (
              <Table.Tr key={`row-${idx}-${String(row[tableData.headers[0]] ?? '')}`}>
                {tableData.headers.map((h) => (
                  <Table.Td key={h} fz="xs">
                    {String(row[h] ?? '-')}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {tableData.rows.length > 50 && (
          <Text size="xs" c="dimmed" ta="center" py="xs">
            İlk 50 satır gösteriliyor (toplam: {tableData.rows.length})
          </Text>
        )}
      </ScrollArea>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Text fw={700} size="lg">
            Rapor Merkezi
          </Text>
          {selectedReports.size > 0 && (
            <Badge size="md" variant="filled" color="blue">
              {selectedReports.size} seçili
            </Badge>
          )}
        </Group>
      }
      size="90vw"
      styles={{
        body: { height: 'calc(85vh - 80px)', display: 'flex', flexDirection: 'column', padding: 0 },
        content: { maxHeight: '85vh' },
      }}
      centered
    >
      {loading ? (
        <Stack align="center" justify="center" h={300}>
          <Loader />
          <Text c="dimmed">Rapor kataloğu yükleniyor...</Text>
        </Stack>
      ) : (
        <>
          {/* Main content - sol panel + ön gösterim */}
          <Box
            style={{
              display: 'flex',
              flex: 1,
              overflow: 'hidden',
            }}
          >
            {/* Sol Panel - Rapor listesi */}
            <Box
              style={{
                width: 380,
                minWidth: 380,
                borderRight: '1px solid var(--mantine-color-gray-3)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Arama + Tümünü seç */}
              <Box p="sm" pb={0}>
                <TextInput
                  placeholder="Rapor ara..."
                  leftSection={<IconSearch size={14} />}
                  size="xs"
                  mb="xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.currentTarget.value)}
                />
                <Group gap="xs" mb="xs">
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={
                      selectedReports.size === totalReports && totalReports > 0 ? (
                        <IconCheckbox size={14} />
                      ) : (
                        <IconSquare size={14} />
                      )
                    }
                    onClick={toggleSelectAll}
                  >
                    {selectedReports.size === totalReports && totalReports > 0 ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                  </Button>
                  <Text size="xs" c="dimmed">
                    {totalReports} rapor
                  </Text>
                </Group>
              </Box>

              <Divider />

              {/* Rapor listesi */}
              <ScrollArea style={{ flex: 1 }} p="xs">
                <Stack gap="xs">
                  {filteredModules.map(renderModuleGroup)}
                  {filteredModules.length === 0 && (
                    <Text size="sm" c="dimmed" ta="center" py="xl">
                      Rapor bulunamadı
                    </Text>
                  )}
                </Stack>
              </ScrollArea>
            </Box>

            {/* Ön Gösterim paneli */}
            <Box
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              p="sm"
            >
              {previewReportId && (
                <Group gap="xs" mb="xs">
                  <Text size="sm" fw={500}>
                    Ön Gösterim: {findReport(previewReportId)?.label}
                  </Text>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    onClick={() => {
                      setPreviewReportId(null);
                      setPreviewData(null);
                    }}
                  >
                    <IconX size={12} />
                  </ActionIcon>
                </Group>
              )}
              <Paper
                withBorder
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                bg="gray.0"
              >
                {renderPreviewPanel()}
              </Paper>
            </Box>
          </Box>

          {/* Alt bar - aksiyonlar */}
          <Divider />
          <Box p="sm">
            {!mailDialogOpen ? (
              <Group justify="space-between">
                <Group gap="xs">
                  <Text size="xs" c="dimmed">
                    {selectedReports.size} rapor seçili
                  </Text>
                </Group>
                <Group gap="sm">
                  <Button
                    size="sm"
                    variant="light"
                    color="blue"
                    leftSection={<IconMail size={16} />}
                    disabled={selectedReports.size === 0}
                    onClick={() => setMailDialogOpen(true)}
                  >
                    Mail Gönder
                  </Button>
                  <Button
                    size="sm"
                    variant="filled"
                    color="green"
                    leftSection={selectedReports.size > 1 ? <IconZip size={16} /> : <IconDownload size={16} />}
                    disabled={selectedReports.size === 0}
                    loading={bulkDownloading}
                    onClick={downloadBulk}
                  >
                    {selectedReports.size > 1 ? `Toplu İndir (${selectedReports.size} rapor)` : 'İndir'}
                  </Button>
                </Group>
              </Group>
            ) : (
              <Group gap="sm">
                <TextInput
                  placeholder="E-posta adresi"
                  size="sm"
                  style={{ flex: 1 }}
                  value={mailEmail}
                  onChange={(e) => setMailEmail(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMail()}
                />
                <Button
                  size="sm"
                  color="blue"
                  leftSection={<IconMail size={16} />}
                  loading={mailSending}
                  onClick={sendMail}
                >
                  Gönder
                </Button>
                <Button size="sm" variant="subtle" onClick={() => setMailDialogOpen(false)}>
                  İptal
                </Button>
              </Group>
            )}
          </Box>
        </>
      )}
    </Modal>
  );
}
