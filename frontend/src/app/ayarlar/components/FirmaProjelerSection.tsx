'use client';

import { Divider, Stack } from '@mantine/core';
import DokumanYonetimi from './DokumanYonetimi';
import FirmaBilgileriCard from './FirmaBilgileriCard';
import ProjelerSection from './ProjelerSection';
import type { FirmaBilgileri } from './types';

interface FirmaProjelerSectionProps {
  firmalar: FirmaBilgileri[];
  firmaLoading: boolean;
  handleOpenFirmaModal: (firma?: FirmaBilgileri) => void;
  handleDeleteFirma: (id: number) => void;
  handleSetVarsayilan: (id: number) => void;
  API_BASE_URL: string;
}

export default function FirmaProjelerSection({
  firmalar,
  firmaLoading,
  handleOpenFirmaModal,
  API_BASE_URL,
}: FirmaProjelerSectionProps) {
  const varsayilanFirma = firmalar.find((f) => f.varsayilan) || firmalar[0];

  return (
    <Stack gap="xl">
      <FirmaBilgileriCard
        firmalar={firmalar}
        firmaLoading={firmaLoading}
        handleOpenFirmaModal={handleOpenFirmaModal}
        API_BASE_URL={API_BASE_URL}
      />

      <Divider />

      <ProjelerSection API_BASE_URL={API_BASE_URL} />

      <Divider />

      <DokumanYonetimi varsayilanFirma={varsayilanFirma} API_BASE_URL={API_BASE_URL} />
    </Stack>
  );
}
