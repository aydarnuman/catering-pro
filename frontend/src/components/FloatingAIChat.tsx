'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Tooltip,
  Transition,
  useMantineColorScheme,
} from '@mantine/core';
import { IconBolt, IconFlame, IconMaximize, IconMinus, IconX } from '@tabler/icons-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { muhasebeAPI } from '@/lib/api/services/muhasebe';
import { tendersAPI } from '@/lib/api/services/tenders';
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
  PERSONEL: { title: 'İK Uzmanı & Mali Müşavir', color: 'violet', icon: '👔' },
  FATURA: { title: 'Fatura Asistanı', color: 'teal', icon: '🧾' },
  CARİ: { title: 'Cari Hesap Uzmanı', color: 'blue', icon: '🏢' },
  SATIN_ALMA: { title: 'Satın Alma Asistanı', color: 'orange', icon: '🛒' },
  STOK: { title: 'Stok Yönetim Asistanı', color: 'green', icon: '📦' },
  GELİR_GİDER: { title: 'Mali Danışman', color: 'cyan', icon: '💰' },
  KASA_BANKA: { title: 'Finans Asistanı', color: 'indigo', icon: '🏦' },
  RAPOR: { title: 'Rapor Analisti', color: 'grape', icon: '📊' },
  MENU_PLANLAMA: { title: 'Menü & Reçete Asistanı', color: 'orange', icon: '👨‍🍳' },
  İHALE: { title: 'İhale Analisti', color: 'red', icon: '📋' },
  'TÜM SİSTEM': { title: 'AI Asistan', color: 'violet', icon: '🤖' },
};

// Sayfa context'ini tespit et
interface PageContext {
  type: 'tender' | 'invoice' | 'cari' | 'personel' | 'stok' | 'planlama' | 'muhasebe' | 'general';
  id?: number | string;
  title?: string;
  data?: Record<string, unknown>;
  pathname?: string; // URL bilgisi
  department?: string; // Department bilgisi
}

// URL'ye göre context type mapping (otomatik tespit için)
const pathToContextType: Record<string, PageContext['type']> = {
  '/tenders': 'tender',
  '/tracking': 'tender',
  '/ihale-uzmani': 'tender',
  '/upload': 'tender',
  '/muhasebe/personel': 'personel',
  '/muhasebe/cariler': 'cari',
  '/muhasebe/faturalar': 'invoice',
  '/muhasebe/stok': 'stok',
  '/muhasebe/satin-alma': 'stok',
  '/muhasebe/gelir-gider': 'muhasebe',
  '/muhasebe/kasa-banka': 'muhasebe',
  '/muhasebe/finans': 'muhasebe',
  '/muhasebe/raporlar': 'muhasebe',
  '/planlama': 'planlama',
  '/muhasebe/menu-planlama': 'planlama',
};

export function FloatingAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [alertCount, setAlertCount] = useState(0);
  const [pageContext, setPageContext] = useState<PageContext | undefined>(undefined);
  const [pendingInitialMessage, setPendingInitialMessage] = useState<string | null>(null);
  const [godModeEnabled, setGodModeEnabled] = useState(false);
  const [showGodModeConfirm, setShowGodModeConfirm] = useState(false);
  const { colorScheme } = useMantineColorScheme();
  const pathname = usePathname();
  const isDark = colorScheme === 'dark';
  const { isMobile, isMounted } = useResponsive();
  const { isSuperAdmin } = useAuth();

  // Path'e göre department belirle
  const department = pathToDepartment[pathname] || 'TÜM SİSTEM';
  const info = departmentInfo[department] || departmentInfo['TÜM SİSTEM'];

  // Sayfa context'ini tespit et
  useEffect(() => {
    const detectPageContext = async () => {
      // İhale detay sayfası: /tenders/123
      const tenderMatch = pathname.match(/^\/tenders\/(\d+)$/);
      if (tenderMatch) {
        const tenderId = tenderMatch[1];
        try {
          const result = await tendersAPI.getTender(Number(tenderId));
          if (result.success && result.data) {
            setPageContext({
              type: 'tender',
              id: tenderId,
              title: result.data.title,
              pathname,
              department,
              data: {
                title: result.data.title,
                organization: result.data.organization_name,
                city: result.data.city,
                deadline: result.data.deadline,
                estimated_cost: result.data.estimated_cost,
              },
            });
            return;
          }
        } catch (e) {
          console.error('Tender context fetch error:', e);
        }
      }

      // Fatura sayfası: /muhasebe/faturalar/123
      const invoiceMatch = pathname.match(/^\/muhasebe\/faturalar\/(\d+)$/);
      if (invoiceMatch) {
        setPageContext({ type: 'invoice', id: invoiceMatch[1], pathname, department });
        return;
      }

      // Cari sayfası: /muhasebe/cariler/123
      const cariMatch = pathname.match(/^\/muhasebe\/cariler\/(\d+)$/);
      if (cariMatch) {
        setPageContext({ type: 'cari', id: cariMatch[1], pathname, department });
        return;
      }

      // Personel sayfası: /muhasebe/personel/123
      const personelMatch = pathname.match(/^\/muhasebe\/personel\/(\d+)$/);
      if (personelMatch) {
        setPageContext({ type: 'personel', id: personelMatch[1], pathname, department });
        return;
      }

      // URL'ye göre otomatik context type belirleme
      const autoContextType = Object.entries(pathToContextType).find(([path]) =>
        pathname.startsWith(path)
      );

      if (autoContextType) {
        setPageContext({
          type: autoContextType[1],
          pathname,
          department,
          data: { module: department },
        });
        return;
      }

      // Genel sayfa - yine de pathname ve department bilgisini gönder
      setPageContext({ type: 'general', pathname, department });
    };

    detectPageContext();
  }, [pathname, department]);

  // Custom event dinleyici - diğer sayfalardan gelen context güncellemeleri için
  // Örn: tracking sayfasında bir ihale seçildiğinde
  useEffect(() => {
    const handleContextUpdate = (event: CustomEvent<PageContext>) => {
      setPageContext(event.detail);
    };

    window.addEventListener('ai-context-update', handleContextUpdate as EventListener);
    return () => {
      window.removeEventListener('ai-context-update', handleContextUpdate as EventListener);
    };
  }, []);

  // Toolbar'dan "Gönder" veya "AI'ya Sor" ile açılış; opsiyonel ilk mesaj
  useEffect(() => {
    const handleOpenAI = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setPendingInitialMessage(detail?.message?.trim() || null);
      setIsOpen(true);
      setIsMinimized(false);
    };

    window.addEventListener('open-ai-chat', handleOpenAI as EventListener);
    return () => window.removeEventListener('open-ai-chat', handleOpenAI as EventListener);
  }, []);

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
  }, []);

  // Uyarı sayısını al
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const result = await muhasebeAPI.getInvoiceStats();

        let count = 0;
        if (result.success && result.data) {
          count += result.data.bekleyen_fatura || 0;
          count += result.data.geciken_fatura || 0;
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

  // Tek AI girişi: sadece alttaki toolbar (metin + Gönder / AI'ya Sor). Floating buton her yerde gizli.
  const showFloatingButton = false;

  return (
    <>
      {/* Floating Button - Ana sayfa dışında göster (tek AI girişi: toolbar) */}
      {showFloatingButton && (
        <Tooltip
          label={
            <Stack gap={4} align="center">
              <Text size="sm" fw={600}>
                {info.icon} {info.title}
              </Text>
              {alertCount > 0 && (
                <Text size="xs" c="red.3">
                  {alertCount} uyarı bekliyor
                </Text>
              )}
              {!isMobile && (
                <Text size="xs" c="dimmed">
                  ⌘K ile aç
                </Text>
              )}
            </Stack>
          }
          position="left"
          withArrow
          disabled={isOpen}
          styles={{ tooltip: { padding: '8px 12px' } }}
        >
          <Box
            style={{
              position: 'fixed',
              /* GenerationToolbar üstünde: toolbar ~200px + 24 bottom */
              bottom:
                isMobile && isMounted ? 'calc(200px + env(safe-area-inset-bottom, 0px))' : 220,
              right: isMobile && isMounted ? 12 : 24,
              zIndex: 50,
            }}
          >
            {/* Outer glow - Artlist altın vurgu */}
            <Box
              style={{
                position: 'absolute',
                inset: -4,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #e6c530, #ca8a04)',
                opacity: isOpen ? 0.8 : 0.4,
                filter: 'blur(8px)',
                transition: 'all 0.3s ease',
                animation: showPulse && !isOpen ? 'pulse 2s infinite' : 'none',
              }}
            />

            {/* Main button - Artlist primary */}
            <Box
              style={{
                position: 'relative',
                width: isMobile && isMounted ? 56 : 68,
                height: isMobile && isMounted ? 56 : 68,
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #e6c530, #ca8a04)',
                boxShadow: isOpen
                  ? '0 8px 32px rgba(230, 197, 48, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)'
                  : '0 6px 24px rgba(230, 197, 48, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid transparent',
                backgroundClip: 'padding-box',
                overflow: 'hidden',
                transform: isOpen ? 'scale(0.95)' : 'scale(1)',
              }}
              onClick={() => setIsOpen(!isOpen)}
              onMouseEnter={(e) => {
                if (!isOpen && !isMobile) {
                  e.currentTarget.style.transform = 'scale(1.08)';
                  e.currentTarget.style.boxShadow = '0 10px 40px rgba(230, 197, 48, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isMobile) {
                  e.currentTarget.style.transform = isOpen ? 'scale(0.95)' : 'scale(1)';
                  e.currentTarget.style.boxShadow = isOpen
                    ? '0 8px 32px rgba(230, 197, 48, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)'
                    : '0 6px 24px rgba(230, 197, 48, 0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
                }
              }}
            >
              {/* Artlist altın border */}
              <Box
                style={{
                  position: 'absolute',
                  inset: -2,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #e6c530, #ca8a04)',
                  zIndex: -1,
                }}
              />
              <Image
                src="/ai-chef-icon-trimmed.png"
                alt="AI Asistan"
                width={isMobile && isMounted ? 44 : 56}
                height={isMobile && isMounted ? 44 : 56}
                style={{
                  position: 'relative',
                  width: isMobile && isMounted ? 44 : 56,
                  height: isMobile && isMounted ? 44 : 56,
                  objectFit: 'cover',
                  borderRadius: '50%',
                }}
              />
            </Box>

            {/* Alert Badge - Improved */}
            {alertCount > 0 && !isOpen && (
              <Badge
                size="sm"
                color="red"
                variant="filled"
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  minWidth: 22,
                  height: 22,
                  padding: '0 6px',
                  borderRadius: 11,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)',
                  border: '2px solid white',
                  fontWeight: 700,
                  animation: 'pulse 1.5s infinite',
                }}
              >
                {alertCount > 9 ? '9+' : alertCount}
              </Badge>
            )}

            {/* Online indicator dot */}
            <Box
              style={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#4ade80',
                border: '2px solid white',
                boxShadow: '0 0 8px rgba(74, 222, 128, 0.6)',
              }}
            />
          </Box>
        </Tooltip>
      )}

      {/* Animations */}
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
        
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        
        @keyframes pulse-green {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.2);
          }
        }
        
        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        @keyframes godmode-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(230, 197, 48, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(230, 197, 48, 0.6);
          }
        }
      `}</style>

      {/* God Mode Confirmation Modal */}
      <Modal
        opened={showGodModeConfirm}
        onClose={() => setShowGodModeConfirm(false)}
        title="⚠️ God Mode Aktifleştir"
        centered
        zIndex={10001}
        styles={{
          header: {
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
            color: 'white',
          },
          title: { fontWeight: 700 },
        }}
      >
        <Stack gap="md">
          <Text size="sm">
            God Mode, AI&apos;ya <strong>sınırsız yetki</strong> verir:
          </Text>
          <Box
            style={{
              background: 'rgba(255, 71, 87, 0.1)',
              borderRadius: 8,
              padding: 12,
              border: '1px solid rgba(255, 71, 87, 0.3)',
            }}
          >
            <Stack gap="xs">
              <Text size="xs">🔥 Doğrudan SQL sorguları çalıştırma</Text>
              <Text size="xs">📁 Dosya sistemi erişimi</Text>
              <Text size="xs">⚡ Shell komutları yürütme</Text>
              <Text size="xs">🔑 Sistem secretlarına erişim</Text>
            </Stack>
          </Box>
          <Text size="xs" c="red" fw={500}>
            ⚠️ Bu mod sadece yetkili Super Admin kullanıcıları içindir!
          </Text>
          <Group justify="flex-end" gap="sm">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => setShowGodModeConfirm(false)}
              size="lg"
            >
              <IconX size={18} />
            </ActionIcon>
            <ActionIcon
              variant="gradient"
              gradient={{ from: 'red', to: 'orange' }}
              onClick={() => {
                setGodModeEnabled(true);
                setShowGodModeConfirm(false);
              }}
              size="lg"
              style={{ boxShadow: '0 0 15px rgba(255, 71, 87, 0.5)' }}
            >
              <IconFlame size={18} />
            </ActionIcon>
          </Group>
        </Stack>
      </Modal>

      {/* Chat Window - Modern Design */}
      <Transition mounted={isOpen} transition="slide-up" duration={300}>
        {(transitionStyles) => (
          <Paper
            style={{
              ...transitionStyles,
              position: 'fixed',
              bottom: isMobile && isMounted ? 0 : 110,
              right: isMobile && isMounted ? 0 : 24,
              left: isMobile && isMounted ? 0 : 'auto',
              top: isMobile && isMounted ? 0 : 'auto',
              zIndex: 9999,
              width: isMobile && isMounted ? '100%' : isMinimized ? 280 : 440,
              height: isMobile && isMounted ? '100%' : isMinimized ? 'auto' : 580,
              maxHeight: isMobile && isMounted ? '100%' : 'calc(100vh - 150px)',
              overflow: 'hidden',
              borderRadius: isMobile && isMounted ? 0 : 20,
              boxShadow:
                isMobile && isMounted
                  ? 'none'
                  : godModeEnabled
                    ? '0 0 40px rgba(230, 197, 48, 0.5), 0 25px 50px -12px rgba(0,0,0,0.5)'
                    : isDark
                      ? '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)'
                      : '0 25px 50px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
              border: godModeEnabled ? '2px solid #e6c530' : 'none',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: isDark ? '#141517' : '#f8f9fa',
            }}
          >
            {/* Header - dark klasik / God Mode gold */}
            <Box
              style={{
                background: godModeEnabled
                  ? 'linear-gradient(135deg, #1a1b1e 0%, rgba(230, 197, 48, 0.15) 100%)'
                  : isDark
                    ? '#1a1b1e'
                    : '#25262b',
                borderBottom: godModeEnabled
                  ? '1px solid rgba(230, 197, 48, 0.3)'
                  : isDark
                    ? '1px solid rgba(255,255,255,0.08)'
                    : '1px solid rgba(0,0,0,0.08)',
                padding: isMinimized ? '4px 10px' : '14px 16px',
                paddingTop:
                  isMobile && isMounted
                    ? 'calc(env(safe-area-inset-top, 0px) + 14px)'
                    : isMinimized
                      ? '4px'
                      : '14px',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s ease',
              }}
              onClick={() => isMinimized && setIsMinimized(false)}
            >
              <Group
                justify="space-between"
                style={{ position: 'relative', zIndex: 1 }}
                gap={isMinimized ? 6 : undefined}
                wrap="nowrap"
              >
                <Group gap={isMinimized ? 6 : 'sm'} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                  {/* AI Avatar - kapalıyken daha küçük / God Mode'da altın */}
                  <Box
                    style={{
                      width: isMinimized ? 24 : 36,
                      height: isMinimized ? 24 : 36,
                      borderRadius: '50%',
                      background: godModeEnabled
                        ? 'linear-gradient(135deg, #e6c530, #ca8a04)'
                        : isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(255,255,255,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: godModeEnabled
                        ? '2px solid #e6c530'
                        : isDark
                          ? '1px solid rgba(255,255,255,0.1)'
                          : '1px solid rgba(255,255,255,0.15)',
                      flexShrink: 0,
                      boxShadow: godModeEnabled ? '0 0 12px rgba(230, 197, 48, 0.5)' : 'none',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <Text size={isMinimized ? 'xs' : 'lg'} style={{ lineHeight: 1 }}>
                      {godModeEnabled ? '⚡' : info.icon}
                    </Text>
                  </Box>
                  <div style={{ minWidth: 0 }}>
                    <Group gap={isMinimized ? 4 : 6} wrap="nowrap">
                      <Text
                        size={isMinimized ? 'xs' : 'sm'}
                        fw={600}
                        c={godModeEnabled ? '#e6c530' : 'white'}
                        style={{ letterSpacing: '0.2px', lineHeight: 1.2, transition: 'color 0.3s' }}
                        truncate
                      >
                        {godModeEnabled
                          ? isMinimized
                            ? '⚡ GOD'
                            : '⚡ GOD MODE'
                          : isMinimized
                            ? 'AI Asistan'
                            : info.title}
                      </Text>
                      {/* Online indicator - God Mode'da altın */}
                      <Box
                        style={{
                          width: isMinimized ? 4 : 6,
                          height: isMinimized ? 4 : 6,
                          borderRadius: '50%',
                          background: godModeEnabled ? '#e6c530' : '#4ade80',
                          opacity: 0.9,
                          flexShrink: 0,
                          boxShadow: godModeEnabled ? '0 0 6px #e6c530' : 'none',
                          transition: 'all 0.3s ease',
                        }}
                      />
                      {/* God Mode Badge - küçük */}
                      {godModeEnabled && !isMinimized && (
                        <Badge
                          size="xs"
                          variant="gradient"
                          gradient={{ from: 'yellow', to: 'orange' }}
                          style={{
                            fontSize: 9,
                            padding: '1px 6px',
                            fontWeight: 700,
                            flexShrink: 0,
                            animation: 'pulse 2s infinite',
                          }}
                        >
                          ADMIN
                        </Badge>
                      )}
                      {/* Kapalıyken tek satır: sohbete devam badge inline */}
                      {isMinimized && (
                        <Badge
                          size="xs"
                          variant="white"
                          style={{
                            background: godModeEnabled
                              ? 'rgba(230, 197, 48, 0.3)'
                              : 'rgba(255,255,255,0.12)',
                            color: godModeEnabled ? '#e6c530' : 'white',
                            cursor: 'pointer',
                            fontSize: 10,
                            padding: '1px 6px',
                            fontWeight: 500,
                            flexShrink: 0,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMinimized(false);
                          }}
                        >
                          💬 Aç
                        </Badge>
                      )}
                    </Group>
                    {!isMinimized && (
                      <Text size="xs" c="rgba(255,255,255,0.8)" mt={2}>
                        {pageContext?.type === 'tender' && pageContext.id
                          ? `📋 İhale ${(() => {
                              const extId = pageContext.data?.external_id;
                              if (
                                extId &&
                                String(extId).length < 12 &&
                                String(extId).includes('/')
                              ) {
                                return extId;
                              }
                              const title = String(
                                pageContext.data?.title || pageContext.title || ''
                              );
                              const match = title.match(/^(\d{4}\/\d+)/);
                              if (match) return match[1];
                              return `#${pageContext.id}`;
                            })()}`
                          : pageContext?.type === 'invoice' && pageContext.id
                            ? `🧾 Fatura #${pageContext.id}`
                            : pageContext?.type === 'cari' && pageContext.id
                              ? `🏢 Cari #${pageContext.id}`
                              : `📍 ${pathname.split('/').filter(Boolean).pop() || 'Ana Sayfa'}`}
                      </Text>
                    )}
                  </div>
                </Group>
                <Group gap={6} wrap="nowrap">
                  {isMinimized && alertCount > 0 && (
                    <Badge size="xs" color="red" variant="filled" style={{ flexShrink: 0 }}>
                      {alertCount}
                    </Badge>
                  )}
                  {/* God Mode Toggle - sadece Super Admin görür */}
                  {isSuperAdmin && !isMinimized && (
                    <Tooltip
                      label={godModeEnabled ? 'God Mode Kapat' : 'God Mode Aç'}
                      withArrow
                      position="bottom"
                    >
                      <ActionIcon
                        variant={godModeEnabled ? 'gradient' : 'subtle'}
                        gradient={godModeEnabled ? { from: 'yellow', to: 'orange' } : undefined}
                        color={godModeEnabled ? undefined : 'gray'}
                        size="sm"
                        style={{
                          background: godModeEnabled ? undefined : 'rgba(255,255,255,0.1)',
                          borderRadius: 6,
                          boxShadow: godModeEnabled ? '0 0 12px rgba(230, 197, 48, 0.5)' : 'none',
                          transition: 'all 0.3s ease',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (godModeEnabled) {
                            setGodModeEnabled(false);
                          } else {
                            setShowGodModeConfirm(true);
                          }
                        }}
                      >
                        <IconFlame
                          size={14}
                          color={godModeEnabled ? 'white' : undefined}
                          style={{
                            animation: godModeEnabled ? 'pulse 1.5s infinite' : 'none',
                          }}
                        />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  {/* Keyboard shortcut hint */}
                  {!isMinimized && !isMobile && !godModeEnabled && (
                    <Tooltip label="Kısayol: ⌘K" withArrow position="bottom">
                      <Badge
                        size="xs"
                        variant="white"
                        style={{
                          background: 'rgba(255,255,255,0.15)',
                          color: 'white',
                          backdropFilter: 'blur(10px)',
                          cursor: 'default',
                        }}
                      >
                        <Group gap={2}>
                          <IconBolt size={10} />
                          AI
                        </Group>
                      </Badge>
                    </Tooltip>
                  )}
                  <ActionIcon
                    variant="transparent"
                    c="white"
                    size={isMinimized ? 'xs' : 'sm'}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 6,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMinimized(!isMinimized);
                    }}
                  >
                    {isMinimized ? <IconMaximize size={12} /> : <IconMinus size={14} />}
                  </ActionIcon>
                  <ActionIcon
                    variant="transparent"
                    c="white"
                    size={isMinimized ? 'xs' : 'sm'}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 6,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                    }}
                  >
                    <IconX size={isMinimized ? 12 : 14} />
                  </ActionIcon>
                </Group>
              </Group>
            </Box>

            {/* Chat Content */}
            {!isMinimized && (
              <Box style={{ flex: 1, overflow: 'hidden' }}>
                <AIChat
                  defaultDepartment={department}
                  compact
                  pageContext={pageContext}
                  defaultGodMode={godModeEnabled}
                  initialMessage={pendingInitialMessage}
                  onInitialMessageConsumed={() => setPendingInitialMessage(null)}
                />
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
