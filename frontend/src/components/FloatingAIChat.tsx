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
  useMantineColorScheme,
  ThemeIcon,
  Stack,
  Kbd
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconRobot, IconSparkles, IconX, IconMinus, IconMaximize, IconMessageCircle, IconBolt } from '@tabler/icons-react';
import { usePathname } from 'next/navigation';
import { AIChat } from './AIChat';
import { API_BASE_URL } from '@/lib/config';

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

// Sayfa context'ini tespit et
interface PageContext {
  type: 'tender' | 'invoice' | 'cari' | 'personel' | 'stok' | 'planlama' | 'muhasebe' | 'general';
  id?: number | string;
  title?: string;
  data?: any;
  pathname?: string;      // URL bilgisi
  department?: string;    // Department bilgisi
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
  const { colorScheme } = useMantineColorScheme();
  const pathname = usePathname();
  const isDark = colorScheme === 'dark';
  const isMobile = useMediaQuery('(max-width: 768px)');

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
          const res = await fetch(`${API_BASE_URL}/api/tenders/${tenderId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.data) {
              setPageContext({
                type: 'tender',
                id: tenderId,
                title: data.data.title,
                pathname,
                department,
                data: {
                  title: data.data.title,
                  organization: data.data.organization_name,
                  city: data.data.city,
                  deadline: data.data.deadline,
                  estimated_cost: data.data.estimated_cost
                }
              });
              return;
            }
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
      const autoContextType = Object.entries(pathToContextType).find(
        ([path]) => pathname.startsWith(path)
      );
      
      if (autoContextType) {
        setPageContext({ 
          type: autoContextType[1], 
          pathname, 
          department,
          data: { module: department }
        });
        return;
      }

      // Genel sayfa - yine de pathname ve department bilgisini gönder
      setPageContext({ type: 'general', pathname, department });
    };

    detectPageContext();
  }, [pathname]);

  // Custom event dinleyici - diğer sayfalardan gelen context güncellemeleri için
  // Örn: tracking sayfasında bir ihale seçildiğinde
  useEffect(() => {
    const handleContextUpdate = (event: CustomEvent<PageContext>) => {
      console.log('📍 AI Context güncellendi:', event.detail);
      setPageContext(event.detail);
    };

    window.addEventListener('ai-context-update', handleContextUpdate as EventListener);
    return () => {
      window.removeEventListener('ai-context-update', handleContextUpdate as EventListener);
    };
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
  }, [pathname]);

  // Uyarı sayısını al
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const [invoiceRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/invoices/stats`).catch(() => null)
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
      {/* Floating Button - Modern Design */}
      <Tooltip 
        label={
          <Stack gap={4} align="center">
            <Text size="sm" fw={600}>{info.icon} {info.title}</Text>
            {alertCount > 0 && <Text size="xs" c="red.3">{alertCount} uyarı bekliyor</Text>}
            {!isMobile && <Text size="xs" c="dimmed">⌘K ile aç</Text>}
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
            bottom: 24, 
            right: 24, 
            zIndex: 1001,
          }}
        >
          {/* Outer glow ring */}
          <Box
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb)',
              opacity: isOpen ? 0.8 : 0.4,
              filter: 'blur(8px)',
              transition: 'all 0.3s ease',
              animation: showPulse && !isOpen ? 'pulse 2s infinite' : 'none',
            }}
          />
          
          {/* Main button */}
          <Box
            style={{
              position: 'relative',
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #ffffff, #f5f5f5)',
              boxShadow: isOpen 
                ? '0 8px 32px rgba(102, 126, 234, 0.6), inset 0 1px 0 rgba(255,255,255,0.8)'
                : '0 6px 24px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255,255,255,0.8)',
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
              if (!isOpen) {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = '0 10px 40px rgba(102, 126, 234, 0.6)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = isOpen ? 'scale(0.95)' : 'scale(1)';
              e.currentTarget.style.boxShadow = isOpen 
                ? '0 8px 32px rgba(102, 126, 234, 0.6), inset 0 1px 0 rgba(255,255,255,0.8)'
                : '0 6px 24px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255,255,255,0.8)';
            }}
          >
            {/* Gradient border */}
            <Box
              style={{
                position: 'absolute',
                inset: -2,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb)',
                zIndex: -1,
              }}
            />
            <Box
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: 'white',
              }}
            />
            <img 
              src="/ai-chef-icon-trimmed.png" 
              alt="AI Asistan" 
              style={{ 
                position: 'relative',
                width: 56, 
                height: 56, 
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
      `}</style>

      {/* Chat Window - Modern Design */}
      <Transition mounted={isOpen} transition="slide-up" duration={300}>
        {(styles) => (
          <Paper
            style={{
              ...styles,
              position: 'fixed',
              // Mobilde tam ekran, desktop'ta normal
              bottom: isMobile ? 0 : 110,
              right: isMobile ? 0 : 24,
              left: isMobile ? 0 : 'auto',
              top: isMobile ? 0 : 'auto',
              zIndex: 1001,
              width: isMobile ? '100%' : (isMinimized ? 340 : 440),
              height: isMobile ? '100%' : (isMinimized ? 'auto' : 580),
              maxHeight: isMobile ? '100%' : 'calc(100vh - 150px)',
              overflow: 'hidden',
              borderRadius: isMobile ? 0 : 20,
              boxShadow: isMobile ? 'none' : '0 25px 50px -12px rgba(102, 126, 234, 0.25), 0 0 0 1px rgba(102, 126, 234, 0.1)',
              border: isMobile ? 'none' : 'none',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: isDark ? '#1a1b1e' : '#ffffff',
            }}
          >
            {/* Header - Modern Glassmorphism */}
            <Box
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                padding: isMinimized ? '10px 16px' : '14px 16px',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
              onClick={() => isMinimized && setIsMinimized(false)}
            >
              {/* Animated background effect */}
              <Box
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
                  animation: 'shimmer 3s infinite',
                }}
              />
              
              <Group justify="space-between" style={{ position: 'relative', zIndex: 1 }}>
                <Group gap="sm">
                  {/* AI Avatar with glow */}
                  <Box
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(10px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 20px rgba(255,255,255,0.3)',
                    }}
                  >
                    <Text size="lg">{info.icon}</Text>
                  </Box>
                  <div>
                    <Group gap={6}>
                      <Text size="sm" fw={700} c="white" style={{ letterSpacing: '0.3px' }}>
                        {isMinimized ? 'AI Asistan' : info.title}
                      </Text>
                      {/* Online indicator */}
                      <Box
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#4ade80',
                          boxShadow: '0 0 8px #4ade80',
                          animation: 'pulse-green 2s infinite',
                        }}
                      />
                    </Group>
                    {!isMinimized && (
                      <Text size="xs" c="rgba(255,255,255,0.8)" mt={2}>
                        {pageContext?.type === 'tender' && pageContext.id 
                          ? `📋 İhale ${(() => {
                              const extId = pageContext.data?.external_id;
                              if (extId && String(extId).length < 12 && String(extId).includes('/')) {
                                return extId;
                              }
                              const title = pageContext.data?.title || pageContext.title || '';
                              const match = title.match(/^(\d{4}\/\d+)/);
                              if (match) return match[1];
                              return '#' + pageContext.id;
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
                <Group gap={6}>
                  {/* Keyboard shortcut hint */}
                  {!isMinimized && !isMobile && (
                    <Tooltip label="Kısayol: ⌘K" withArrow position="bottom">
                      <Badge 
                        size="xs" 
                        variant="white" 
                        style={{ 
                          background: 'rgba(255,255,255,0.15)', 
                          color: 'white',
                          backdropFilter: 'blur(10px)',
                          cursor: 'default'
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
                    size="sm"
                    style={{ 
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 6,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMinimized(!isMinimized);
                    }}
                  >
                    {isMinimized ? <IconMaximize size={14} /> : <IconMinus size={14} />}
                  </ActionIcon>
                  <ActionIcon 
                    variant="transparent" 
                    c="white" 
                    size="sm"
                    style={{ 
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 6,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                    }}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              </Group>
              
              {/* Quick actions bar when minimized */}
              {isMinimized && (
                <Group gap="xs" mt={8} style={{ position: 'relative', zIndex: 1 }}>
                  <Badge 
                    size="xs" 
                    variant="white"
                    style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      color: 'white',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMinimized(false);
                    }}
                  >
                    💬 Sohbete devam et
                  </Badge>
                  {alertCount > 0 && (
                    <Badge size="xs" color="red" variant="filled">
                      {alertCount} uyarı
                    </Badge>
                  )}
                </Group>
              )}
            </Box>

            {/* Chat Content */}
            {!isMinimized && (
              <Box style={{ flex: 1, overflow: 'hidden' }}>
                <AIChat defaultDepartment={department} compact pageContext={pageContext} />
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

