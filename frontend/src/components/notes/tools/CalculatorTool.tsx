'use client';

/**
 * CalculatorTool - Hesap Makinasi
 * Catering isletmesi icin hizli hesaplamalar:
 * - Genel hesap makinasi
 * - Porsiyon maliyet hesabi
 * - KDV hesaplama
 */

import {
  ActionIcon,
  Badge,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  useMantineColorScheme,
} from '@mantine/core';
import { IconBackspace, IconCalculator, IconEqual, IconTrash } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

type CalcMode = 'general' | 'porsiyon' | 'kdv';

// ─── Genel Hesap Makinasi ───
function GeneralCalculator() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [display, setDisplay] = useState('0');
  const [history, setHistory] = useState<string[]>([]);
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = useCallback(
    (digit: string) => {
      if (waitingForOperand) {
        setDisplay(digit);
        setWaitingForOperand(false);
      } else {
        setDisplay(display === '0' ? digit : display + digit);
      }
    },
    [display, waitingForOperand]
  );

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(`${display}.`);
    }
  }, [display, waitingForOperand]);

  const clearAll = useCallback(() => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  }, []);

  const performOperation = useCallback(
    (nextOp: string) => {
      const current = Number.parseFloat(display);

      if (prevValue == null) {
        setPrevValue(current);
      } else if (operator) {
        let result = prevValue;
        switch (operator) {
          case '+':
            result = prevValue + current;
            break;
          case '-':
            result = prevValue - current;
            break;
          case '*':
            result = prevValue * current;
            break;
          case '/':
            result = current !== 0 ? prevValue / current : 0;
            break;
        }
        const expr = `${prevValue} ${operator} ${current} = ${result}`;
        setHistory((prev) => [expr, ...prev].slice(0, 10));
        setPrevValue(result);
        setDisplay(String(result));
      }

      setOperator(nextOp === '=' ? null : nextOp);
      setWaitingForOperand(true);
    },
    [display, prevValue, operator]
  );

  const handlePercent = useCallback(() => {
    const current = Number.parseFloat(display);
    setDisplay(String(current / 100));
  }, [display]);

  const handleBackspace = useCallback(() => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  }, [display]);

  const btnStyle = (color?: string) => ({
    height: 44,
    fontSize: 16,
    fontWeight: 600 as const,
    ...(color ? {} : {}),
  });

  return (
    <Stack gap="sm">
      {/* Display */}
      <Paper
        p="md"
        radius="md"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <Text size="xs" c="dimmed" ta="right" mb={4}>
          {prevValue != null && operator ? `${prevValue} ${operator}` : '\u00A0'}
        </Text>
        <Text
          ta="right"
          fw={700}
          style={{
            fontSize: display.length > 12 ? 20 : display.length > 8 ? 26 : 32,
            fontFamily: 'monospace',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {display}
        </Text>
      </Paper>

      {/* Buttons */}
      <SimpleGrid cols={4} spacing={6}>
        <Button variant="light" color="gray" onClick={clearAll} style={btnStyle()}>
          C
        </Button>
        <Button variant="light" color="gray" onClick={handlePercent} style={btnStyle()}>
          %
        </Button>
        <Button variant="light" color="gray" onClick={handleBackspace} style={btnStyle()}>
          <IconBackspace size={18} />
        </Button>
        <Button variant="light" color="orange" onClick={() => performOperation('/')} style={btnStyle()}>
          /
        </Button>

        {['7', '8', '9'].map((d) => (
          <Button key={d} variant="default" onClick={() => inputDigit(d)} style={btnStyle()}>
            {d}
          </Button>
        ))}
        <Button variant="light" color="orange" onClick={() => performOperation('*')} style={btnStyle()}>
          x
        </Button>

        {['4', '5', '6'].map((d) => (
          <Button key={d} variant="default" onClick={() => inputDigit(d)} style={btnStyle()}>
            {d}
          </Button>
        ))}
        <Button variant="light" color="orange" onClick={() => performOperation('-')} style={btnStyle()}>
          -
        </Button>

        {['1', '2', '3'].map((d) => (
          <Button key={d} variant="default" onClick={() => inputDigit(d)} style={btnStyle()}>
            {d}
          </Button>
        ))}
        <Button variant="light" color="orange" onClick={() => performOperation('+')} style={btnStyle()}>
          +
        </Button>

        <Button variant="default" onClick={() => inputDigit('0')} style={{ ...btnStyle(), gridColumn: 'span 2' }}>
          0
        </Button>
        <Button variant="default" onClick={inputDecimal} style={btnStyle()}>
          .
        </Button>
        <Button variant="filled" color="violet" onClick={() => performOperation('=')} style={btnStyle()}>
          <IconEqual size={18} />
        </Button>
      </SimpleGrid>

      {/* History */}
      {history.length > 0 && (
        <>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600}>
              Gecmis
            </Text>
            <ActionIcon variant="subtle" size="xs" onClick={() => setHistory([])}>
              <IconTrash size={12} />
            </ActionIcon>
          </Group>
          <Stack gap={2}>
            {history.map((h) => (
              <Text key={h} size="xs" c="dimmed" ff="monospace">
                {h}
              </Text>
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}

// ─── Porsiyon Maliyet Hesabi ───
function PorsiyonCalculator() {
  const [malzemeAdi, setMalzemeAdi] = useState('');
  const [birimFiyat, setBirimFiyat] = useState<number | string>('');
  const [miktar, setMiktar] = useState<number | string>('');
  const [porsiyonSayisi, setPorsiyonSayisi] = useState<number | string>('');
  const [items, setItems] = useState<Array<{ ad: string; toplam: number }>>([]);

  const toplamMaliyet = typeof birimFiyat === 'number' && typeof miktar === 'number' ? birimFiyat * miktar : 0;
  const porsiyonMaliyet =
    toplamMaliyet > 0 && typeof porsiyonSayisi === 'number' && porsiyonSayisi > 0
      ? toplamMaliyet / porsiyonSayisi
      : 0;

  const handleAdd = useCallback(() => {
    if (toplamMaliyet > 0) {
      setItems((prev) => [...prev, { ad: malzemeAdi || 'Isimsiz', toplam: toplamMaliyet }]);
      setMalzemeAdi('');
      setBirimFiyat('');
      setMiktar('');
    }
  }, [malzemeAdi, toplamMaliyet]);

  const genelToplam = items.reduce((s, i) => s + i.toplam, 0);

  return (
    <Stack gap="sm">
      <TextInput
        label="Malzeme adi"
        placeholder="ornek: Pirinc"
        value={malzemeAdi}
        onChange={(e) => setMalzemeAdi(e.currentTarget.value)}
        size="sm"
      />
      <SimpleGrid cols={2}>
        <NumberInput
          label="Birim fiyat (TL)"
          placeholder="0.00"
          value={birimFiyat}
          onChange={setBirimFiyat}
          min={0}
          decimalScale={2}
          size="sm"
        />
        <NumberInput
          label="Miktar (kg/adet)"
          placeholder="0"
          value={miktar}
          onChange={setMiktar}
          min={0}
          decimalScale={2}
          size="sm"
        />
      </SimpleGrid>
      <NumberInput
        label="Porsiyon sayisi"
        placeholder="ornek: 500"
        value={porsiyonSayisi}
        onChange={setPorsiyonSayisi}
        min={1}
        size="sm"
      />

      {toplamMaliyet > 0 && (
        <Paper p="sm" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Toplam maliyet:</Text>
            <Text size="sm" fw={700}>{toplamMaliyet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</Text>
          </Group>
          {porsiyonMaliyet > 0 && (
            <Group justify="space-between" mt={4}>
              <Text size="sm" c="dimmed">Porsiyon basina:</Text>
              <Text size="sm" fw={700} c="violet">
                {porsiyonMaliyet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
              </Text>
            </Group>
          )}
        </Paper>
      )}

      <Button variant="light" size="xs" onClick={handleAdd} disabled={toplamMaliyet <= 0}>
        Listeye ekle
      </Button>

      {items.length > 0 && (
        <>
          <Divider label="Malzeme Listesi" labelPosition="left" />
          <Stack gap={4}>
            {items.map((item) => (
              <Group key={`${item.ad}-${item.toplam}`} justify="space-between">
                <Text size="xs">{item.ad}</Text>
                <Text size="xs" fw={600}>{item.toplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</Text>
              </Group>
            ))}
            <Divider />
            <Group justify="space-between">
              <Text size="sm" fw={700}>Genel Toplam:</Text>
              <Text size="sm" fw={700} c="violet">
                {genelToplam.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
              </Text>
            </Group>
            {typeof porsiyonSayisi === 'number' && porsiyonSayisi > 0 && (
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Toplam porsiyon maliyeti:</Text>
                <Text size="xs" fw={700} c="teal">
                  {(genelToplam / porsiyonSayisi).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL/porsiyon
                </Text>
              </Group>
            )}
          </Stack>
          <Button variant="subtle" color="red" size="xs" onClick={() => setItems([])}>
            Listeyi temizle
          </Button>
        </>
      )}
    </Stack>
  );
}

// ─── KDV Hesaplama ───
function KdvCalculator() {
  const [tutar, setTutar] = useState<number | string>('');
  const [kdvOran, setKdvOran] = useState<number>(10);
  const [direction, setDirection] = useState<'add' | 'remove'>('add');

  const tutarNum = typeof tutar === 'number' ? tutar : 0;
  let kdvTutar = 0;
  let netTutar = 0;
  let brutTutar = 0;

  if (direction === 'add') {
    kdvTutar = tutarNum * (kdvOran / 100);
    netTutar = tutarNum;
    brutTutar = tutarNum + kdvTutar;
  } else {
    netTutar = tutarNum / (1 + kdvOran / 100);
    kdvTutar = tutarNum - netTutar;
    brutTutar = tutarNum;
  }

  return (
    <Stack gap="sm">
      <SegmentedControl
        value={direction}
        onChange={(v) => setDirection(v as 'add' | 'remove')}
        size="xs"
        data={[
          { value: 'add', label: 'KDV Ekle' },
          { value: 'remove', label: 'KDV Cikar' },
        ]}
        fullWidth
      />
      <NumberInput
        label={direction === 'add' ? 'KDV haric tutar (TL)' : 'KDV dahil tutar (TL)'}
        placeholder="0.00"
        value={tutar}
        onChange={setTutar}
        min={0}
        decimalScale={2}
        size="sm"
      />
      <Group gap="xs">
        <Text size="xs" c="dimmed" fw={500}>
          KDV Orani:
        </Text>
        {[1, 10, 20].map((oran) => (
          <Badge
            key={oran}
            size="lg"
            variant={kdvOran === oran ? 'filled' : 'light'}
            color={kdvOran === oran ? 'violet' : 'gray'}
            style={{ cursor: 'pointer' }}
            onClick={() => setKdvOran(oran)}
          >
            %{oran}
          </Badge>
        ))}
      </Group>

      {tutarNum > 0 && (
        <Paper p="sm" radius="md" withBorder>
          <Stack gap={4}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Net tutar:</Text>
              <Text size="sm" fw={600}>{netTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">KDV (%{kdvOran}):</Text>
              <Text size="sm" fw={600} c="orange">{kdvTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</Text>
            </Group>
            <Divider />
            <Group justify="space-between">
              <Text size="sm" fw={700}>Brut tutar:</Text>
              <Text size="sm" fw={700} c="violet">{brutTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL</Text>
            </Group>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

// ─── Ana Component ───
export function CalculatorTool() {
  const [mode, setMode] = useState<CalcMode>('general');

  return (
    <Stack gap="md">
      <Group gap="sm">
        <IconCalculator size={20} />
        <Text size="lg" fw={700}>
          Hesap Makinasi
        </Text>
      </Group>

      <SegmentedControl
        value={mode}
        onChange={(v) => setMode(v as CalcMode)}
        size="xs"
        data={[
          { value: 'general', label: 'Genel' },
          { value: 'porsiyon', label: 'Porsiyon Maliyet' },
          { value: 'kdv', label: 'KDV' },
        ]}
        fullWidth
      />

      <ScrollArea style={{ flex: 1 }}>
        {mode === 'general' && <GeneralCalculator />}
        {mode === 'porsiyon' && <PorsiyonCalculator />}
        {mode === 'kdv' && <KdvCalculator />}
      </ScrollArea>
    </Stack>
  );
}
