'use client';

import { Container, Title, Text, Stack } from '@mantine/core';
import { AIChat } from '@/components/AIChat';

export default function AIChatPage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1} size="h2" mb={4}>🤖 AI Asistan</Title>
          <Text c="dimmed" size="lg">
            Claude AI ile güçlendirilmiş akıllı asistan. Sistem hakkında her şeyi sorabilirsiniz.
          </Text>
        </div>

        <AIChat />
      </Stack>
    </Container>
  );
}
