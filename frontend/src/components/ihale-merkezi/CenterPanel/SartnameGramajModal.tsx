'use client';

import {
  Badge,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Table,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconClipboardList,
  IconClock,
  IconScale,
  IconToolsKitchen2,
  IconUsers,
} from '@tabler/icons-react';
import type { AnalysisData } from '../types';

interface SartnameGramajModalProps {
  opened: boolean;
  onClose: () => void;
  analysisData?: AnalysisData;
}

export function SartnameGramajModal({ opened, onClose, analysisData }: SartnameGramajModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" color="orange" size="sm">
            <IconScale size={14} />
          </ThemeIcon>
          <Text fw={600}>Şartname/Gramaj Detayları</Text>
        </Group>
      }
      size="xl"
    >
      <ScrollArea h={500}>
        <Stack gap="md">
          {/* Öğün Bilgileri */}
          {analysisData?.ogun_bilgileri && analysisData.ogun_bilgileri.length > 0 && (
            <Paper p="md" withBorder radius="md">
              <Group gap="xs" mb="md">
                <ThemeIcon size="sm" variant="light" color="orange">
                  <IconToolsKitchen2 size={14} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  Öğün Bilgileri
                </Text>
                <Badge size="xs" variant="light" color="orange">
                  {analysisData.ogun_bilgileri.length} öğün
                </Badge>
              </Group>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Öğün Türü</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Miktar</Table.Th>
                    <Table.Th>Birim</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analysisData.ogun_bilgileri.map((ogun) => (
                    <Table.Tr key={`modal-ogun-${ogun.tur}-${ogun.miktar}`}>
                      <Table.Td>
                        <Text fw={500}>{ogun.tur}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={600} c="orange">
                          {ogun.miktar?.toLocaleString('tr-TR') || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text c="dimmed">{ogun.birim || 'adet'}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              {(analysisData.gunluk_ogun_sayisi || analysisData.kisi_sayisi) && (
                <Group gap="md" mt="md">
                  {analysisData.gunluk_ogun_sayisi && (
                    <Badge variant="outline" color="orange" size="md">
                      Günlük: {analysisData.gunluk_ogun_sayisi} öğün
                    </Badge>
                  )}
                  {analysisData.kisi_sayisi && (
                    <Badge variant="outline" color="blue" size="md">
                      Kişi: {analysisData.kisi_sayisi}
                    </Badge>
                  )}
                </Group>
              )}
            </Paper>
          )}

          {/* Servis Saatleri */}
          {analysisData?.servis_saatleri &&
            Object.keys(analysisData.servis_saatleri).length > 0 && (
              <Paper p="md" withBorder radius="md">
                <Group gap="xs" mb="md">
                  <ThemeIcon size="sm" variant="light" color="teal">
                    <IconClock size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={600}>
                    Servis Saatleri
                  </Text>
                </Group>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Öğün</Table.Th>
                      <Table.Th>Saat Aralığı</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {Object.entries(analysisData.servis_saatleri)
                      .filter(([, val]) => val && val !== 'Belirtilmemiş')
                      .map(([key, val]) => (
                        <Table.Tr key={`modal-servis-${key}`}>
                          <Table.Td>
                            <Text fw={500} tt="capitalize">
                              {key.replace(/_/g, ' ')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge variant="light" color="teal" size="lg">
                              {val}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            )}

          {/* Personel Gereksinimleri */}
          {analysisData?.personel_detaylari && analysisData.personel_detaylari.length > 0 && (
            <Paper p="md" withBorder radius="md">
              <Group gap="xs" mb="md">
                <ThemeIcon size="sm" variant="light" color="indigo">
                  <IconUsers size={14} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  Personel Gereksinimleri
                </Text>
                <Badge size="xs" variant="light" color="indigo">
                  {analysisData.personel_detaylari.reduce((sum, p) => sum + (p.adet || 0), 0)} kişi
                </Badge>
              </Group>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Pozisyon</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Adet</Table.Th>
                    <Table.Th>Ücret Oranı</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {analysisData.personel_detaylari.map((p) => (
                    <Table.Tr key={`modal-personel-${p.pozisyon}-${p.adet}`}>
                      <Table.Td>
                        <Text fw={500}>{p.pozisyon}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={600} c="indigo">
                          {p.adet}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text c="dimmed" size="sm">
                          {p.ucret_orani || '-'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {/* Teknik Şartlar */}
          {analysisData?.teknik_sartlar && analysisData.teknik_sartlar.length > 0 && (
            <Paper p="md" withBorder radius="md">
              <Group gap="xs" mb="md">
                <ThemeIcon size="sm" variant="light" color="grape">
                  <IconClipboardList size={14} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  Teknik Şartlar & Standartlar
                </Text>
              </Group>
              <Stack gap="xs">
                {analysisData.teknik_sartlar.slice(0, 15).map((sart) => {
                  const sartText =
                    typeof sart === 'string'
                      ? sart
                      : (sart as { madde?: string; aciklama?: string }).madde ||
                        (sart as { madde?: string; aciklama?: string }).aciklama ||
                        '';
                  return (
                    <Paper
                      key={`modal-sart-${sartText.substring(0, 50)}`}
                      p="xs"
                      withBorder
                      radius="sm"
                    >
                      <Text size="sm">{sartText}</Text>
                    </Paper>
                  );
                })}
                {analysisData.teknik_sartlar.length > 15 && (
                  <Text size="xs" c="dimmed" ta="center">
                    +{analysisData.teknik_sartlar.length - 15} daha fazla teknik şart
                  </Text>
                )}
              </Stack>
            </Paper>
          )}

          {/* Veri Yoksa */}
          {!analysisData?.ogun_bilgileri?.length &&
            !analysisData?.servis_saatleri &&
            !analysisData?.personel_detaylari?.length &&
            !analysisData?.teknik_sartlar?.length && (
              <Paper p="xl" withBorder radius="md" ta="center">
                <ThemeIcon size="xl" variant="light" color="gray" mx="auto" mb="md">
                  <IconScale size={24} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Bu ihale için şartname/gramaj bilgisi bulunamadı.
                </Text>
                <Text size="xs" c="dimmed" mt="xs">
                  Dökümanlar analiz edildikten sonra detaylı bilgiler burada görünecektir.
                </Text>
              </Paper>
            )}
        </Stack>
      </ScrollArea>
    </Modal>
  );
}
