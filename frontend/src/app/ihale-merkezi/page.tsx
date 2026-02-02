'use client';

import { Box, Center, Loader, Text } from '@mantine/core';
import { Suspense } from 'react';
import { IhaleMerkeziLayout } from '@/components/ihale-merkezi/IhaleMerkeziLayout';

function IhaleMerkeziContent() {
  return <IhaleMerkeziLayout />;
}

export default function IhaleMerkeziPage() {
  return (
    <Suspense
      fallback={
        <Center h="100vh">
          <Box ta="center">
            <Loader size="lg" color="violet" />
            <Text c="dimmed" mt="md">
              İhale Merkezi yükleniyor...
            </Text>
          </Box>
        </Center>
      }
    >
      <IhaleMerkeziContent />
    </Suspense>
  );
}
