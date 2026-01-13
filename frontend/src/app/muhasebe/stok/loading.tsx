'use client';

import { Center, Loader } from '@mantine/core';

export default function Loading() {
  return (
    <Center h="50vh">
      <Loader size="lg" />
    </Center>
  );
}

