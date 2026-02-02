'use client';

/**
 * /tenders/[id] sayfası artık /ihale-merkezi'ne yönlendiriliyor.
 * İhale detay görüntüleme ihale-merkezi'nde birleştirildi.
 */

import { Box, Center, Loader, Text } from '@mantine/core';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function TenderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenderId = params.id as string;

  useEffect(() => {
    if (tenderId) {
      router.replace(`/ihale-merkezi?tab=all&tender=${tenderId}`);
    } else {
      router.replace('/ihale-merkezi?tab=all');
    }
  }, [router, tenderId]);

  return (
    <Center h="100vh">
      <Box ta="center">
        <Loader size="lg" color="violet" />
        <Text c="dimmed" mt="md">
          İhale Merkezi'ne yönlendiriliyorsunuz...
        </Text>
      </Box>
    </Center>
  );
}
