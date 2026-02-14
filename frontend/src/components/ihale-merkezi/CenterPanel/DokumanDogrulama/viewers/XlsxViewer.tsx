'use client';

import { Box, Loader, ScrollArea, Select, Table, Text } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

interface XlsxViewerProps {
  url: string;
  /** Cell selection callback */
  onTextSelect?: (text: string) => void;
}

interface SheetData {
  name: string;
  rows: string[][];
}

export function XlsxViewer({ url, onTextSelect }: XlsxViewerProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadXlsx() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const parsedSheets: SheetData[] = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          return { name, rows };
        });

        if (!cancelled) {
          setSheets(parsedSheets);
          if (parsedSheets.length > 0) {
            setActiveSheet(parsedSheets[0].name);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Excel dosyası yüklenemedi');
          setLoading(false);
        }
      }
    }

    loadXlsx();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const handleCellClick = useCallback(
    (cellValue: string) => {
      if (cellValue && onTextSelect) {
        onTextSelect(cellValue);
      }
    },
    [onTextSelect]
  );

  if (loading) {
    return (
      <Box ta="center" py="xl">
        <Loader size="sm" />
        <Text size="xs" c="dimmed" mt="xs">
          Excel dosyası yükleniyor...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box ta="center" py="xl">
        <Text size="sm" c="red">
          {error}
        </Text>
      </Box>
    );
  }

  const currentSheet = sheets.find((s) => s.name === activeSheet);
  if (!currentSheet) return null;

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sheet selector */}
      {sheets.length > 1 && (
        <Box p="xs" style={{ flexShrink: 0 }}>
          <Select
            size="xs"
            value={activeSheet}
            onChange={setActiveSheet}
            data={sheets.map((s) => ({ value: s.name, label: s.name }))}
            w={200}
          />
        </Box>
      )}

      {/* Table content */}
      <ScrollArea style={{ flex: 1 }} offsetScrollbars>
        <Table
          striped
          highlightOnHover
          withTableBorder
          withColumnBorders
          fz="xs"
          style={{ minWidth: currentSheet.rows[0]?.length ? currentSheet.rows[0].length * 120 : 'auto' }}
        >
          <Table.Thead>
            {currentSheet.rows.length > 0 && (
              <Table.Tr>
                {currentSheet.rows[0].map((cell, ci) => (
                  <Table.Th
                    key={`h-${ci}`}
                    style={{ whiteSpace: 'nowrap', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {String(cell)}
                  </Table.Th>
                ))}
              </Table.Tr>
            )}
          </Table.Thead>
          <Table.Tbody>
            {currentSheet.rows.slice(1).map((row, ri) => (
              <Table.Tr key={`r-${ri}`}>
                {row.map((cell, ci) => (
                  <Table.Td
                    key={`c-${ri}-${ci}`}
                    style={{
                      cursor: cell ? 'pointer' : 'default',
                      maxWidth: 250,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => handleCellClick(String(cell))}
                  >
                    {String(cell)}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
}
