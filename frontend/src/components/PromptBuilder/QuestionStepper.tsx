'use client';

import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  HoverCard,
  MultiSelect,
  NumberInput,
  Paper,
  Progress,
  RingProgress,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconCheck,
  IconCode,
  IconHelpCircle,
  IconSparkles,
  IconTemplate,
  IconWand,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { PBAnswers, PBQuestion, PBTemplate } from './types';

interface QuestionStepperProps {
  questions: PBQuestion[];
  templates: PBTemplate[];
  answers: PBAnswers;
  selectedTemplateId: number | null;
  onAnswerChange: (variableName: string, value: string) => void;
  onTemplateSelect: (id: number) => void;
  onBack: () => void;
  onGenerate: () => void;
  isGenerating?: boolean;
  categoryColor?: string;
}

export function QuestionStepper({
  questions,
  templates,
  answers,
  selectedTemplateId,
  onAnswerChange,
  onTemplateSelect,
  onBack,
  onGenerate,
  isGenerating,
  categoryColor = 'violet',
}: QuestionStepperProps) {
  const [, setHoveredTemplate] = useState<number | null>(null);

  // Tamamlanma yüzdesi
  const { completionPercent, answeredCount, totalRequired } = useMemo(() => {
    const requiredQuestions = questions.filter((q) => q.is_required);
    const answered = requiredQuestions.filter(
      (q) => answers[q.variable_name]?.trim()
    ).length;
    return {
      completionPercent:
        requiredQuestions.length > 0
          ? (answered / requiredQuestions.length) * 100
          : 0,
      answeredCount: answered,
      totalRequired: requiredQuestions.length,
    };
  }, [questions, answers]);

  // Tüm zorunlu sorular cevaplandı mı?
  const canGenerate = useMemo(() => {
    const requiredQuestions = questions.filter((q) => q.is_required);
    const allAnswered = requiredQuestions.every(
      (q) => answers[q.variable_name]?.trim()
    );
    return allAnswered && selectedTemplateId !== null;
  }, [questions, answers, selectedTemplateId]);

  // Style labels
  const styleLabels: Record<string, { label: string; icon: string; color: string }> = {
    professional: { label: 'Profesyonel', icon: '👔', color: 'blue' },
    friendly: { label: 'Samimi', icon: '😊', color: 'green' },
    technical: { label: 'Teknik', icon: '⚙️', color: 'violet' },
    creative: { label: 'Yaratıcı', icon: '💡', color: 'orange' },
  };

  // Soru render helper
  const renderQuestion = (question: PBQuestion, index: number) => {
    const value = answers[question.variable_name] || '';
    const isAnswered = !!value?.trim();

    const commonStyles = {
      styles: {
        input: {
          borderColor: isAnswered
            ? `var(--mantine-color-${categoryColor}-5)`
            : undefined,
        },
        label: {
          marginBottom: 8,
        },
      },
    };

    const label = (
      <Group gap={6} wrap="nowrap">
        <Badge
          size="xs"
          circle
          variant={isAnswered ? 'filled' : 'outline'}
          color={isAnswered ? 'green' : 'gray'}
        >
          {isAnswered ? <IconCheck size={10} /> : index + 1}
        </Badge>
        <Text size="sm" fw={500}>
          {question.question_text}
        </Text>
        {question.is_required && (
          <Text c="red" size="xs" fw={700}>
            *
          </Text>
        )}
        {question.help_text && (
          <Tooltip label={question.help_text} multiline maw={300} withArrow>
            <ThemeIcon
              variant="subtle"
              color="gray"
              size="xs"
              radius="xl"
              style={{ cursor: 'help' }}
            >
              <IconHelpCircle size={12} />
            </ThemeIcon>
          </Tooltip>
        )}
      </Group>
    );

    switch (question.question_type) {
      case 'select':
        return (
          <Select
            label={label}
            placeholder={question.placeholder || 'Seçiniz...'}
            data={
              question.options?.map((opt) => ({
                value: opt.value,
                label: opt.label,
              })) || []
            }
            value={value || null}
            onChange={(val) => onAnswerChange(question.variable_name, val || '')}
            searchable
            clearable
            size="md"
            radius="md"
            {...commonStyles}
          />
        );

      case 'multiselect':
        return (
          <MultiSelect
            label={label}
            placeholder={question.placeholder || 'Seçiniz...'}
            data={
              question.options?.map((opt) => ({
                value: opt.value,
                label: opt.label,
              })) || []
            }
            value={value ? value.split(',') : []}
            onChange={(vals) =>
              onAnswerChange(question.variable_name, vals.join(','))
            }
            searchable
            clearable
            size="md"
            radius="md"
            {...commonStyles}
          />
        );

      case 'textarea':
        return (
          <Textarea
            label={label}
            placeholder={question.placeholder || 'Detayları yazın...'}
            value={value}
            onChange={(e) =>
              onAnswerChange(question.variable_name, e.currentTarget.value)
            }
            minRows={3}
            maxRows={6}
            autosize
            size="md"
            radius="md"
            {...commonStyles}
          />
        );

      case 'number':
        return (
          <NumberInput
            label={label}
            placeholder={question.placeholder || '0'}
            value={value ? Number(value) : ''}
            onChange={(val) =>
              onAnswerChange(question.variable_name, String(val || ''))
            }
            thousandSeparator="."
            decimalSeparator=","
            size="md"
            radius="md"
            {...commonStyles}
          />
        );

      default:
        return (
          <TextInput
            label={label}
            placeholder={question.placeholder || 'Yazınız...'}
            value={value}
            onChange={(e) =>
              onAnswerChange(question.variable_name, e.currentTarget.value)
            }
            size="md"
            radius="md"
            {...commonStyles}
          />
        );
    }
  };

  return (
    <Grid gutter="xl">
      {/* Sol Panel: Sorular */}
      <Grid.Col span={{ base: 12, lg: 7 }}>
        <Stack gap="lg">
          {/* Sorular Kartı */}
          <Card
            p="xl"
            radius="lg"
            withBorder
          >
            <Group justify="space-between" mb="lg">
              <Group gap="sm">
                <ThemeIcon
                  size={40}
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: categoryColor, to: 'grape' }}
                >
                  <IconWand size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={600} size="lg">
                    Detayları Girin
                  </Text>
                  <Text size="xs" c="dimmed">
                    Daha iyi sonuçlar için tüm alanları doldurun
                  </Text>
                </div>
              </Group>

              {/* Ring Progress */}
              <Group gap="xs">
                <RingProgress
                  size={50}
                  thickness={4}
                  roundCaps
                  sections={[
                    {
                      value: completionPercent,
                      color: completionPercent === 100 ? 'green' : categoryColor,
                    },
                  ]}
                  label={
                    <Text size="xs" ta="center" fw={700}>
                      {answeredCount}/{totalRequired}
                    </Text>
                  }
                />
              </Group>
            </Group>

            {/* Sorular */}
            <Stack gap="lg">
              {questions.map((question, index) => (
                <Box key={question.id}>{renderQuestion(question, index)}</Box>
              ))}
            </Stack>
          </Card>
        </Stack>
      </Grid.Col>

      {/* Sağ Panel: Şablon Seçimi & Actions */}
      <Grid.Col span={{ base: 12, lg: 5 }}>
        <Stack gap="lg" style={{ position: 'sticky', top: 100 }}>
          {/* Şablon Seçimi */}
          <Card
            p="xl"
            radius="lg"
            withBorder
          >
            <Group gap="sm" mb="lg">
              <ThemeIcon size={36} radius="xl" variant="light" color={categoryColor}>
                <IconTemplate size={18} />
              </ThemeIcon>
              <div>
                <Text fw={600}>Şablon Seçin</Text>
                <Text size="xs" c="dimmed">
                  {templates.length} şablon mevcut
                </Text>
              </div>
            </Group>

            <Stack gap="sm">
              {templates.map((template) => {
                const isSelected = selectedTemplateId === template.id;
                const styleInfo = styleLabels[template.style] || styleLabels.professional;

                return (
                  <HoverCard
                    key={template.id}
                    width={320}
                    shadow="xl"
                    position="left"
                    withArrow
                    openDelay={300}
                  >
                    <HoverCard.Target>
                      <Paper
                        p="md"
                        radius="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          borderWidth: 2,
                          borderColor: isSelected
                            ? `var(--mantine-color-${categoryColor}-5)`
                            : 'var(--mantine-color-gray-3)',
                          backgroundColor: isSelected
                            ? `var(--mantine-color-${categoryColor}-0)`
                            : undefined,
                          transition: 'all 0.2s ease',
                          transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                        }}
                        onClick={() => onTemplateSelect(template.id)}
                        onMouseEnter={() => setHoveredTemplate(template.id)}
                        onMouseLeave={() => setHoveredTemplate(null)}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Stack gap={4}>
                            <Group gap="xs">
                              <Text fw={600} size="sm">
                                {template.name}
                              </Text>
                              {template.is_default && (
                                <Badge size="xs" color="green" variant="filled">
                                  ⭐ Önerilen
                                </Badge>
                              )}
                            </Group>
                            <Group gap="xs">
                              <Badge
                                size="xs"
                                variant="light"
                                color={styleInfo.color}
                                leftSection={<Text size="xs">{styleInfo.icon}</Text>}
                              >
                                {styleInfo.label}
                              </Badge>
                              <Text size="xs" c="dimmed">
                                {template.usage_count}× kullanıldı
                              </Text>
                            </Group>
                          </Stack>
                          {isSelected && (
                            <ThemeIcon color="green" radius="xl" size="sm">
                              <IconCheck size={12} />
                            </ThemeIcon>
                          )}
                        </Group>
                      </Paper>
                    </HoverCard.Target>
                    <HoverCard.Dropdown>
                      <Stack gap="xs">
                        <Group gap="xs">
                          <IconCode size={14} />
                          <Text size="sm" fw={500}>
                            Şablon Önizleme
                          </Text>
                        </Group>
                        <Text
                          size="xs"
                          c="dimmed"
                          style={{
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'monospace',
                            maxHeight: 200,
                            overflow: 'auto',
                          }}
                        >
                          {template.template_text.slice(0, 300)}
                          {template.template_text.length > 300 && '...'}
                        </Text>
                      </Stack>
                    </HoverCard.Dropdown>
                  </HoverCard>
                );
              })}
            </Stack>
          </Card>

          {/* Progress Card */}
          <Card
            p="lg"
            radius="lg"
            withBorder
            bg={`${categoryColor}.0`}
          >
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  Hazırlık Durumu
                </Text>
                <Badge
                  color={completionPercent === 100 && selectedTemplateId ? 'green' : 'yellow'}
                  variant="light"
                >
                  {completionPercent === 100 && selectedTemplateId
                    ? '✅ Hazır!'
                    : `${Math.round(completionPercent)}%`}
                </Badge>
              </Group>
              <Progress
                value={completionPercent}
                size="lg"
                radius="xl"
                color={completionPercent === 100 ? 'green' : categoryColor}
                animated={completionPercent < 100}
                striped={completionPercent < 100}
              />
              {!selectedTemplateId && (
                <Text size="xs" c="yellow">
                  ⚠️ Şablon seçmeyi unutmayın
                </Text>
              )}
            </Stack>
          </Card>

          {/* Action Buttons */}
          <Stack gap="sm">
            <Button
              fullWidth
              size="xl"
              variant="gradient"
              gradient={{ from: categoryColor, to: 'grape', deg: 135 }}
              rightSection={<IconSparkles size={20} />}
              onClick={onGenerate}
              loading={isGenerating}
              disabled={!canGenerate}
            >
              ✨ Prompt Oluştur
            </Button>

            <Button
              fullWidth
              variant="subtle"
              color="gray"
              leftSection={<IconArrowLeft size={16} />}
              onClick={onBack}
            >
              Kategorilere Dön
            </Button>
          </Stack>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
