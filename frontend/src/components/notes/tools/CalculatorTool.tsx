'use client';

/**
 * CalculatorTool - Hesap Makinasi
 * Catering isletmesi icin hizli hesaplamalar:
 * - Genel hesap makinasi (varsayilan)
 * - Kar marji hesabi
 * - Birim cevirici (kg/g/lt/ml)
 * - Kisi basi maliyet
 * - Fire hesabi
 */

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconArrowsExchange,
  IconBackspace,
  IconChartBar,
  IconEqual,
  IconFlame,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';

type CalcMode = 'general' | 'kar-marji' | 'birim-cevirici' | 'kisi-basi' | 'fire';

const CALC_MODES: Array<{ value: CalcMode; label: string; icon: React.ReactNode }> = [
  { value: 'general', label: 'Hesap Makinasi', icon: null },
  { value: 'kar-marji', label: 'Kar Marji', icon: <IconChartBar size={14} /> },
  { value: 'birim-cevirici', label: 'Birim Cevirici', icon: <IconArrowsExchange size={14} /> },
  { value: 'kisi-basi', label: 'Kisi Basi Maliyet', icon: <IconUsers size={14} /> },
  { value: 'fire', label: 'Fire Hesabi', icon: <IconFlame size={14} /> },
];

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

  const btnBase = {
    height: 44,
    fontSize: 15,
    fontWeight: 600 as const,
  };

  return (
    <Stack gap={6}>
      {/* Display */}
      <Paper
        p="sm"
        radius="md"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)'
            : 'linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.01) 100%)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
          minHeight: 70,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <Text size="xs" c="dimmed" ta="right" mb={2} ff="monospace" style={{ opacity: 0.7 }}>
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
            background: isDark
              ? 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)'
              : 'linear-gradient(135deg, #1a1a1e 0%, #333 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {display}
        </Text>
      </Paper>

      {/* Buttons */}
      <SimpleGrid cols={4} spacing={5}>
        <Button className="ws-calc-btn" variant="light" color="gray" onClick={clearAll} style={btnBase} radius="md">
          C
        </Button>
        <Button
          className="ws-calc-btn"
          variant="light"
          color="gray"
          onClick={handlePercent}
          style={btnBase}
          radius="md"
        >
          %
        </Button>
        <Button
          className="ws-calc-btn"
          variant="light"
          color="gray"
          onClick={handleBackspace}
          style={btnBase}
          radius="md"
        >
          <IconBackspace size={17} />
        </Button>
        <Button
          className="ws-calc-btn"
          variant="filled"
          color="orange"
          onClick={() => performOperation('/')}
          style={{ ...btnBase, opacity: 0.9 }}
          radius="md"
        >
          /
        </Button>

        {['7', '8', '9'].map((d) => (
          <Button
            className="ws-calc-btn"
            key={d}
            variant="default"
            onClick={() => inputDigit(d)}
            style={btnBase}
            radius="md"
          >
            {d}
          </Button>
        ))}
        <Button
          className="ws-calc-btn"
          variant="filled"
          color="orange"
          onClick={() => performOperation('*')}
          style={{ ...btnBase, opacity: 0.9 }}
          radius="md"
        >
          x
        </Button>

        {['4', '5', '6'].map((d) => (
          <Button
            className="ws-calc-btn"
            key={d}
            variant="default"
            onClick={() => inputDigit(d)}
            style={btnBase}
            radius="md"
          >
            {d}
          </Button>
        ))}
        <Button
          className="ws-calc-btn"
          variant="filled"
          color="orange"
          onClick={() => performOperation('-')}
          style={{ ...btnBase, opacity: 0.9 }}
          radius="md"
        >
          -
        </Button>

        {['1', '2', '3'].map((d) => (
          <Button
            className="ws-calc-btn"
            key={d}
            variant="default"
            onClick={() => inputDigit(d)}
            style={btnBase}
            radius="md"
          >
            {d}
          </Button>
        ))}
        <Button
          className="ws-calc-btn"
          variant="filled"
          color="orange"
          onClick={() => performOperation('+')}
          style={{ ...btnBase, opacity: 0.9 }}
          radius="md"
        >
          +
        </Button>

        <Button
          className="ws-calc-btn"
          variant="default"
          onClick={() => inputDigit('0')}
          style={{ ...btnBase, gridColumn: 'span 2' }}
          radius="md"
        >
          0
        </Button>
        <Button className="ws-calc-btn" variant="default" onClick={inputDecimal} style={btnBase} radius="md">
          .
        </Button>
        <Button
          className="ws-calc-btn"
          variant="filled"
          onClick={() => performOperation('=')}
          style={{
            ...btnBase,
            background: 'linear-gradient(135deg, var(--mantine-color-violet-6) 0%, var(--mantine-color-violet-8) 100%)',
          }}
          radius="md"
        >
          <IconEqual size={18} />
        </Button>
      </SimpleGrid>

      {/* History */}
      {history.length > 0 && (
        <Paper
          p="xs"
          radius="md"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
          }}
        >
          <Group justify="space-between" mb={4}>
            <Text size="xs" c="dimmed" fw={600}>
              Gecmis
            </Text>
            <ActionIcon variant="subtle" size="xs" onClick={() => setHistory([])}>
              <IconTrash size={12} />
            </ActionIcon>
          </Group>
          <Stack gap={2}>
            {history.map((h) => (
              <Text key={h} size="xs" c="dimmed" ff="monospace" style={{ opacity: 0.8 }}>
                {h}
              </Text>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

// ─── Kar Marji Hesabi ───
function KarMarjiCalculator() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [maliyet, setMaliyet] = useState<number | string>('');
  const [satisFiyati, setSatisFiyati] = useState<number | string>('');

  const maliyetNum = typeof maliyet === 'number' ? maliyet : 0;
  const satisNum = typeof satisFiyati === 'number' ? satisFiyati : 0;

  const kar = satisNum - maliyetNum;
  const karMarji = satisNum > 0 ? (kar / satisNum) * 100 : 0;
  const markup = maliyetNum > 0 ? (kar / maliyetNum) * 100 : 0;
  const hasResult = maliyetNum > 0 && satisNum > 0;

  return (
    <Stack gap="sm">
      <SimpleGrid cols={2}>
        <NumberInput
          label="Maliyet (TL)"
          placeholder="0.00"
          value={maliyet}
          onChange={setMaliyet}
          min={0}
          decimalScale={2}
          size="sm"
          radius="md"
        />
        <NumberInput
          label="Satis fiyati (TL)"
          placeholder="0.00"
          value={satisFiyati}
          onChange={setSatisFiyati}
          min={0}
          decimalScale={2}
          size="sm"
          radius="md"
        />
      </SimpleGrid>
      {hasResult && (
        <Paper
          p="sm"
          radius="md"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
          }}
        >
          <Stack gap={6}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Kar:
              </Text>
              <Text size="sm" fw={700} c={kar >= 0 ? 'teal' : 'red'}>
                {kar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
              </Text>
            </Group>
            <Divider />
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Kar marji:
              </Text>
              <Badge size="lg" variant="light" color={karMarji >= 0 ? 'teal' : 'red'}>
                %{karMarji.toFixed(1)}
              </Badge>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Markup:
              </Text>
              <Badge size="lg" variant="light" color="violet">
                %{markup.toFixed(1)}
              </Badge>
            </Group>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

// ─── Birim Cevirici ───
type UnitCategory = 'weight' | 'volume';
const UNIT_CONVERSIONS: Record<UnitCategory, Array<{ value: string; label: string; toBase: number }>> = {
  weight: [
    { value: 'kg', label: 'Kilogram', toBase: 1000 },
    { value: 'g', label: 'Gram', toBase: 1 },
    { value: 'ton', label: 'Ton', toBase: 1_000_000 },
  ],
  volume: [
    { value: 'lt', label: 'Litre', toBase: 1000 },
    { value: 'ml', label: 'Mililitre', toBase: 1 },
    { value: 'dl', label: 'Desilitre', toBase: 100 },
  ],
};

function BirimCevirici() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [category, setCategory] = useState<UnitCategory>('weight');
  const [fromUnit, setFromUnit] = useState<string>('kg');
  const [toUnit, setToUnit] = useState<string>('g');
  const [value, setValue] = useState<number | string>('');

  const units = UNIT_CONVERSIONS[category];
  const fromDef = units.find((u) => u.value === fromUnit);
  const toDef = units.find((u) => u.value === toUnit);
  const valueNum = typeof value === 'number' ? value : 0;
  const result = fromDef && toDef && valueNum > 0 ? (valueNum * fromDef.toBase) / toDef.toBase : 0;

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge
          size="md"
          variant={category === 'weight' ? 'filled' : 'light'}
          color={category === 'weight' ? 'violet' : 'gray'}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setCategory('weight');
            setFromUnit('kg');
            setToUnit('g');
          }}
        >
          Agirlik
        </Badge>
        <Badge
          size="md"
          variant={category === 'volume' ? 'filled' : 'light'}
          color={category === 'volume' ? 'violet' : 'gray'}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setCategory('volume');
            setFromUnit('lt');
            setToUnit('ml');
          }}
        >
          Hacim
        </Badge>
      </Group>
      <NumberInput
        label="Deger"
        placeholder="0"
        value={value}
        onChange={setValue}
        min={0}
        decimalScale={4}
        size="sm"
        radius="md"
      />
      <SimpleGrid cols={2}>
        <Select
          label="Birimden"
          data={units.map((u) => ({ value: u.value, label: u.label }))}
          value={fromUnit}
          onChange={(v) => v && setFromUnit(v)}
          size="sm"
          radius="md"
        />
        <Select
          label="Birime"
          data={units.map((u) => ({ value: u.value, label: u.label }))}
          value={toUnit}
          onChange={(v) => v && setToUnit(v)}
          size="sm"
          radius="md"
        />
      </SimpleGrid>
      {result > 0 && (
        <Paper
          p="sm"
          radius="md"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
          }}
        >
          <Group justify="center" gap="xs">
            <Text size="lg" fw={700} c="violet">
              {result.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}
            </Text>
            <Text size="sm" c="dimmed">
              {toUnit}
            </Text>
          </Group>
        </Paper>
      )}
    </Stack>
  );
}

// ─── Kisi Basi Maliyet ───
function KisiBasiCalculator() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [toplamMaliyet, setToplamMaliyet] = useState<number | string>('');
  const [kisiSayisi, setKisiSayisi] = useState<number | string>('');

  const toplamNum = typeof toplamMaliyet === 'number' ? toplamMaliyet : 0;
  const kisiNum = typeof kisiSayisi === 'number' ? kisiSayisi : 0;
  const kisiBasiMaliyet = toplamNum > 0 && kisiNum > 0 ? toplamNum / kisiNum : 0;

  return (
    <Stack gap="sm">
      <NumberInput
        label="Toplam maliyet (TL)"
        placeholder="0.00"
        value={toplamMaliyet}
        onChange={setToplamMaliyet}
        min={0}
        decimalScale={2}
        size="sm"
        radius="md"
      />
      <NumberInput
        label="Kisi sayisi"
        placeholder="ornek: 500"
        value={kisiSayisi}
        onChange={setKisiSayisi}
        min={1}
        size="sm"
        radius="md"
      />
      {kisiBasiMaliyet > 0 && (
        <Paper
          p="sm"
          radius="md"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
          }}
        >
          <Stack gap={4} align="center">
            <Text size="xs" c="dimmed">
              Kisi basi maliyet
            </Text>
            <Text size="xl" fw={700} c="violet">
              {kisiBasiMaliyet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
            </Text>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

// ─── Fire Hesabi ───
function FireCalculator() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const [brutAgirlik, setBrutAgirlik] = useState<number | string>('');
  const [fireOrani, setFireOrani] = useState<number | string>(15);

  const brutNum = typeof brutAgirlik === 'number' ? brutAgirlik : 0;
  const fireNum = typeof fireOrani === 'number' ? fireOrani : 0;
  const fireMiktari = brutNum * (fireNum / 100);
  const netMiktar = brutNum - fireMiktari;

  return (
    <Stack gap="sm">
      <NumberInput
        label="Brut agirlik (kg)"
        placeholder="0.00"
        value={brutAgirlik}
        onChange={setBrutAgirlik}
        min={0}
        decimalScale={2}
        size="sm"
        radius="md"
      />
      <Stack gap={4}>
        <Text size="xs" c="dimmed" fw={500}>
          Fire orani:
        </Text>
        <Group gap="xs">
          {[5, 10, 15, 20, 25, 30].map((oran) => (
            <Badge
              key={oran}
              size="md"
              variant={fireOrani === oran ? 'filled' : 'light'}
              color={fireOrani === oran ? 'orange' : 'gray'}
              style={{ cursor: 'pointer' }}
              onClick={() => setFireOrani(oran)}
            >
              %{oran}
            </Badge>
          ))}
        </Group>
        <NumberInput
          placeholder="Ozel oran"
          value={fireOrani}
          onChange={setFireOrani}
          min={0}
          max={100}
          decimalScale={1}
          size="xs"
          radius="md"
          suffix="%"
          style={{ maxWidth: 120 }}
        />
      </Stack>
      {brutNum > 0 && (
        <Paper
          p="sm"
          radius="md"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
          }}
        >
          <Stack gap={6}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Fire miktari:
              </Text>
              <Text size="sm" fw={600} c="orange">
                {fireMiktari.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} kg
              </Text>
            </Group>
            <Divider />
            <Group justify="space-between">
              <Text size="sm" fw={700}>
                Net kullanilabilir:
              </Text>
              <Text size="sm" fw={700} c="teal">
                {netMiktar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} kg
              </Text>
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
    <Stack gap="sm">
      {/* Compact mode selector - only visible when not in general mode */}
      {mode !== 'general' && (
        <Group justify="space-between" align="center">
          <Group gap={6}>
            {CALC_MODES.find((m) => m.value === mode)?.icon}
            <Text size="sm" fw={600}>
              {CALC_MODES.find((m) => m.value === mode)?.label}
            </Text>
          </Group>
          <Button variant="subtle" size="xs" color="gray" onClick={() => setMode('general')} radius="md">
            Hesap Makinasi
          </Button>
        </Group>
      )}

      {/* Mode dropdown - always available */}
      <Select
        placeholder="Fonksiyon sec..."
        data={CALC_MODES.filter((m) => m.value !== 'general').map((m) => ({
          value: m.value,
          label: m.label,
        }))}
        value={mode === 'general' ? null : mode}
        onChange={(v) => setMode((v as CalcMode) || 'general')}
        size="xs"
        radius="md"
        clearable
        styles={{
          input: { fontSize: 12 },
        }}
      />

      {/* Content */}
      <Box key={mode} className="ws-tool-fade-in">
        {mode === 'general' && <GeneralCalculator />}
        {mode === 'kar-marji' && <KarMarjiCalculator />}
        {mode === 'birim-cevirici' && <BirimCevirici />}
        {mode === 'kisi-basi' && <KisiBasiCalculator />}
        {mode === 'fire' && <FireCalculator />}
      </Box>
    </Stack>
  );
}
