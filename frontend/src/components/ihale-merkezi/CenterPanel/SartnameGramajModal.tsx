'use client';

import { Badge, Button, Group, Modal, Paper, ScrollArea, Stack, Table, Text, ThemeIcon } from '@mantine/core';
import {
  IconChevronDown,
  IconChevronUp,
  IconClipboardList,
  IconClock,
  IconScale,
  IconToolsKitchen2,
  IconUsers,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { AnalysisData } from '../types';
import { isRealPersonelPosition } from './cards';

interface SartnameGramajModalProps {
  opened: boolean;
  onClose: () => void;
  analysisData?: AnalysisData;
}

export function SartnameGramajModal({ opened, onClose, analysisData }: SartnameGramajModalProps) {
  const [teknikExpanded, setTeknikExpanded] = useState(false);

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
                {analysisData.toplam_ogun_sayisi && (
                  <Badge size="xs" variant="light" color="orange">
                    Toplam: {Number(analysisData.toplam_ogun_sayisi).toLocaleString('tr-TR')} öğün
                  </Badge>
                )}
              </Group>
              {/* Tablo formatı: Azure'dan gelen rows/headers yapısı */}
              {analysisData.ogun_bilgileri.some((o) => o.rows && o.headers) ? (
                <ScrollArea>
                  {analysisData.ogun_bilgileri
                    .filter((tablo) => tablo.rows && tablo.headers)
                    .map((tablo, tabloIdx) => (
                      <Table
                        key={`modal-ogun-tablo-${tabloIdx}`}
                        striped
                        highlightOnHover
                        withTableBorder
                        withColumnBorders
                        mb="md"
                        style={{ fontSize: '0.8rem' }}
                      >
                        <Table.Thead>
                          <Table.Tr>
                            {(tablo.headers ?? []).map((header, hIdx) => (
                              <Table.Th
                                key={`modal-ogun-h-${tabloIdx}-${hIdx}`}
                                style={hIdx > 0 ? { textAlign: 'right', whiteSpace: 'nowrap' } : undefined}
                              >
                                {header}
                              </Table.Th>
                            ))}
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {(tablo.rows ?? []).map((row, rIdx) => {
                            const firstCol = String(row[0] || '')
                              .toLowerCase()
                              .trim();
                            const isToplam = firstCol === 'toplam';
                            return (
                              <Table.Tr
                                key={`modal-ogun-r-${tabloIdx}-${rIdx}`}
                                style={
                                  isToplam
                                    ? {
                                        fontWeight: 700,
                                        backgroundColor: 'var(--mantine-color-orange-0)',
                                      }
                                    : undefined
                                }
                              >
                                {row.map((cell, cIdx) => (
                                  <Table.Td
                                    key={`modal-ogun-c-${tabloIdx}-${rIdx}-${cIdx}`}
                                    style={cIdx > 0 ? { textAlign: 'right' } : undefined}
                                  >
                                    <Text
                                      size="xs"
                                      fw={isToplam ? 700 : cIdx === 0 ? 500 : undefined}
                                      c={cIdx > 0 && !isToplam ? 'orange' : undefined}
                                    >
                                      {cell}
                                    </Text>
                                  </Table.Td>
                                ))}
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    ))}
                </ScrollArea>
              ) : (
                /* Basit format: tur/miktar/birim */
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
              )}
              {(analysisData.gunluk_ogun_sayisi || analysisData.kisi_sayisi) && (
                <Group gap="md" mt="md">
                  {analysisData.gunluk_ogun_sayisi && analysisData.gunluk_ogun_sayisi !== 'Belirtilmemiş' && (
                    <Badge variant="outline" color="orange" size="md">
                      Günlük: {analysisData.gunluk_ogun_sayisi} öğün
                    </Badge>
                  )}
                  {analysisData.kisi_sayisi && analysisData.kisi_sayisi !== 'Belirtilmemiş' && (
                    <Badge variant="outline" color="blue" size="md">
                      Kişi: {analysisData.kisi_sayisi}
                    </Badge>
                  )}
                </Group>
              )}
            </Paper>
          )}

          {/* Servis Saatleri */}
          {analysisData?.servis_saatleri && Object.keys(analysisData.servis_saatleri).length > 0 && (
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
          {analysisData?.personel_detaylari &&
            analysisData.personel_detaylari.length > 0 &&
            (() => {
              const realPersonel = analysisData.personel_detaylari.filter((p) => isRealPersonelPosition(p.pozisyon));
              const locations = analysisData.personel_detaylari.filter((p) => !isRealPersonelPosition(p.pozisyon));
              if (realPersonel.length === 0) return null;
              return (
                <Paper p="md" withBorder radius="md">
                  <Group gap="xs" mb="md">
                    <ThemeIcon size="sm" variant="light" color="indigo">
                      <IconUsers size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={600}>
                      Personel Gereksinimleri
                    </Text>
                    <Badge size="xs" variant="light" color="indigo">
                      {realPersonel.reduce((sum, p) => sum + (Number(p.adet) || 0), 0)} kişi
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
                      {realPersonel.map((p) => (
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
                  {/* Lokasyonlar ayrı göster */}
                  {locations.length > 0 && (
                    <>
                      <Text size="xs" fw={600} c="dimmed" mt="md" mb="xs">
                        Hizmet Lokasyonları ({locations.length})
                      </Text>
                      <Stack gap={4}>
                        {locations.map((loc) => (
                          <Group key={`modal-loc-${loc.pozisyon}`} gap="xs">
                            <Text size="xs" c="dimmed">
                              •
                            </Text>
                            <Text size="xs">{loc.pozisyon}</Text>
                            {loc.adet > 0 && (
                              <Badge size="xs" variant="light" color="gray">
                                {loc.adet} kişi
                              </Badge>
                            )}
                          </Group>
                        ))}
                      </Stack>
                    </>
                  )}
                </Paper>
              );
            })()}

          {/* Teknik Şartlar */}
          {analysisData?.teknik_sartlar &&
            analysisData.teknik_sartlar.length > 0 &&
            (() => {
              const INITIAL_COUNT = 15;
              const allItems = analysisData.teknik_sartlar;
              const displayItems = teknikExpanded ? allItems : allItems.slice(0, INITIAL_COUNT);
              const hasMore = allItems.length > INITIAL_COUNT;
              const remaining = allItems.length - INITIAL_COUNT;

              return (
                <Paper p="md" withBorder radius="md">
                  <Group gap="xs" mb="md" justify="space-between">
                    <Group gap="xs">
                      <ThemeIcon size="sm" variant="light" color="grape">
                        <IconClipboardList size={14} />
                      </ThemeIcon>
                      <Text size="sm" fw={600}>
                        Teknik Şartlar & Standartlar
                      </Text>
                      <Badge size="xs" variant="light" color="grape">
                        {allItems.length}
                      </Badge>
                    </Group>
                  </Group>
                  <Stack gap="xs">
                    {displayItems.map((sart, idx) => {
                      const sartText =
                        typeof sart === 'string'
                          ? sart
                          : (sart as { madde?: string; aciklama?: string }).madde ||
                            (sart as { madde?: string; aciklama?: string }).aciklama ||
                            '';
                      return (
                        <Paper key={`modal-sart-${idx}-${sartText.substring(0, 30)}`} p="xs" withBorder radius="sm">
                          <Text size="sm">{sartText}</Text>
                        </Paper>
                      );
                    })}
                    {hasMore && (
                      <Button
                        variant="subtle"
                        color="grape"
                        size="xs"
                        fullWidth
                        onClick={() => setTeknikExpanded(!teknikExpanded)}
                        rightSection={teknikExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                      >
                        {teknikExpanded ? 'Daralt' : `+${remaining} daha fazla teknik şart göster`}
                      </Button>
                    )}
                  </Stack>
                </Paper>
              );
            })()}

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
