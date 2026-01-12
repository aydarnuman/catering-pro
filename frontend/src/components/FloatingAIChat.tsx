'use client';

import { useState, useEffect } from 'react';
import {
  ActionIcon,
  Paper,
  Transition,
  Box,
  Group,
  Text,
  CloseButton,
  Badge,
  Tooltip,
  useMantineColorScheme
} from '@mantine/core';
import { IconRobot, IconSparkles, IconX, IconMinus } from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import { AIChat } from './AIChat';

// Path'e göre department mapping
const pathToDepartment: Record<string, string> = {
  '/muhasebe/personel': 'PERSONEL',
  '/muhasebe/faturalar': 'FATURA',
  '/muhasebe/cariler': 'CARİ',
  '/muhasebe/satin-alma': 'SATIN_ALMA',
  '/muhasebe/stok': 'STOK',
  '/muhasebe/gelir-gider': 'GELİR_GİDER',
  '/muhasebe/kasa-banka': 'KASA_BANKA',
  '/muhasebe/raporlar': 'RAPOR',
  '/muhasebe/menu-planlama': 'MENU_PLANLAMA',
  '/tenders': 'İHALE',
  '/upload': 'İHALE',
  '/tracking': 'İHALE',
};

// Department'a göre başlık ve renk
const departmentInfo: Record<string, { title: string; color: string; icon: string }> = {
  'PERSONEL': { title: 'İK Uzmanı & Mali Müşavir', color: 'violet', icon: '👔' },
  'FATURA': { title: 'Fatura Asistanı', color: 'teal', icon: '🧾' },
  'CARİ': { title: 'Cari Hesap Uzmanı', color: 'blue', icon: '🏢' },
  'SATIN_ALMA': { title: 'Satın Alma Asistanı', color: 'orange', icon: '🛒' },
  'STOK': { title: 'Stok Yönetim Asistanı', color: 'green', icon: '📦' },
  'GELİR_GİDER': { title: 'Mali Danışman', color: 'cyan', icon: '💰' },
  'KASA_BANKA': { title: 'Finans Asistanı', color: 'indigo', icon: '🏦' },
  'RAPOR': { title: 'Rapor Analisti', color: 'grape', icon: '📊' },
  'MENU_PLANLAMA': { title: 'Menü & Reçete Asistanı', color: 'orange', icon: '👨‍🍳' },
  'İHALE': { title: 'İhale Analisti', color: 'red', icon: '📋' },
  'TÜM SİSTEM': { title: 'AI Asistan', color: 'violet', icon: '🤖' },
};

export function FloatingAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [alertCount, setAlertCount] = useState(0);
  const { colorScheme } = useMantineColorScheme();
  const pathname = usePathname();
  const isDark = colorScheme === 'dark';

  // Path'e göre department belirle
  const department = pathToDepartment[pathname] || 'TÜM SİSTEM';
  const info = departmentInfo[department] || departmentInfo['TÜM SİSTEM'];

  // İlk açılışta pulse animasyonu, 5 saniye sonra durur
  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Sayfa değiştiğinde pulse'ı tekrar göster
  useEffect(() => {
    setShowPulse(true);
    const timer = setTimeout(() => setShowPulse(false), 3000);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Uyarı sayısını al
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const [invoiceRes] = await Promise.all([
          fetch('http://localhost:3001/api/invoices/stats').catch(() => null)
        ]);
        
        let count = 0;
        if (invoiceRes?.ok) {
          const data = await invoiceRes.json();
          count += data.bekleyen_fatura || 0;
          count += data.geciken_fatura || 0;
        }
        setAlertCount(count);
      } catch (e) {
        console.error('Alert fetch error:', e);
      }
    };
    
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Her 1 dakikada bir güncelle
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Floating Button */}
      <Transition mounted={!isOpen} transition="scale" duration={200}>
        {(styles) => (
          <Tooltip 
            label={`${info.icon} ${info.title}${alertCount > 0 ? ` (${alertCount} uyarı)` : ''}`} 
            position="left"
            withArrow
          >
            <Box style={{ ...styles, position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
              <ActionIcon
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
                  transition: 'all 0.3s ease',
                }}
                onClick={() => setIsOpen(true)}
                className={showPulse ? 'pulse-animation' : ''}
              >
                <IconSparkles size={28} color="white" />
              </ActionIcon>
              {/* Alert Badge */}
              {alertCount > 0 && (
                <Badge
                  size="sm"
                  color="red"
                  variant="filled"
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    borderRadius: 10,
                  }}
                >
                  {alertCount > 9 ? '9+' : alertCount}
                </Badge>
              )}
            </Box>
          </Tooltip>
        )}
      </Transition>

      {/* Pulse Animation Style */}
      <style jsx global>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.7);
          }
          70% {
            box-shadow: 0 0 0 15px rgba(102, 126, 234, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(102, 126, 234, 0);
          }
        }
        .pulse-animation {
          animation: pulse 2s infinite;
        }
        .pulse-animation:hover {
          animation: none;
          transform: scale(1.1);
        }
      `}</style>

      {/* Chat Window */}
      <Transition mounted={isOpen} transition="slide-up" duration={300}>
        {(styles) => (
          <Paper
            style={{
              ...styles,
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 1000,
              width: isMinimized ? 320 : 420,
              height: isMinimized ? 60 : 600,
              maxHeight: 'calc(100vh - 100px)',
              overflow: 'hidden',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Header */}
            <Box
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '12px 16px',
                cursor: 'pointer',
              }}
              onClick={() => isMinimized && setIsMinimized(false)}
            >
              <Group justify="space-between">
                <Group gap="xs">
                  <Text size="xl">{info.icon}</Text>
                  <div>
                    <Text size="sm" fw={600} c="white">
                      {info.title}
                    </Text>
                    {!isMinimized && (
                      <Text size="xs" c="rgba(255,255,255,0.7)">
                        {pathname.split('/').pop() || 'Genel'} sayfası
                      </Text>
                    )}
                  </div>
                </Group>
                <Group gap={4}>
                  <Badge 
                    size="xs" 
                    variant="white" 
                    color="white"
                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
                  >
                    AI
                  </Badge>
                  <ActionIcon 
                    variant="transparent" 
                    c="white" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMinimized(!isMinimized);
                    }}
                  >
                    <IconMinus size={16} />
                  </ActionIcon>
                  <ActionIcon 
                    variant="transparent" 
                    c="white" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                    }}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Box>

            {/* Chat Content */}
            {!isMinimized && (
              <Box style={{ flex: 1, overflow: 'hidden' }}>
                <AIChat defaultDepartment={department} compact />
              </Box>
            )}
          </Paper>
        )}
      </Transition>

      {/* Backdrop for mobile */}
      <Transition mounted={isOpen} transition="fade" duration={200}>
        {(styles) => (
          <Box
            style={{
              ...styles,
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 999,
              display: 'none', // Sadece mobilde göster
            }}
            onClick={() => setIsOpen(false)}
            hiddenFrom="sm"
          />
        )}
      </Transition>
    </>
  );
}

