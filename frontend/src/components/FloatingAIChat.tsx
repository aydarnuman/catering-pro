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
import { useMediaQuery } from '@mantine/hooks';
import { IconRobot, IconSparkles, IconX, IconMinus } from '@tabler/icons-react';
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
      {/* Floating Button - Her zaman görünür */}
      <Tooltip 
        label={`${info.icon} ${info.title}${alertCount > 0 ? ` (${alertCount} uyarı)` : ''}`} 
        position="left"
        withArrow
        disabled={isOpen}
      >
        <Box style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1001 }}>
          <Box
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'white',
              boxShadow: '0 6px 30px rgba(102, 126, 234, 0.5)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #667eea',
              overflow: 'hidden',
            }}
            onClick={() => setIsOpen(!isOpen)}
            className={showPulse && !isOpen ? 'pulse-animation' : ''}
          >
            <img 
              src="/ai-chef-icon-trimmed.png" 
              alt="AI Asistan" 
              style={{ 
                width: 64, 
                height: 64, 
                objectFit: 'cover',
              }} 
            />
          </Box>
          {/* Alert Badge */}
          {alertCount > 0 && !isOpen && (
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

      {/* Chat Window - Butonun üstünde açılır */}
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
              width: isMobile ? '100%' : (isMinimized ? 320 : 420),
              height: isMobile ? '100%' : (isMinimized ? 60 : 550),
              maxHeight: isMobile ? '100%' : 'calc(100vh - 150px)',
              overflow: 'hidden',
              borderRadius: isMobile ? 0 : 16,
              boxShadow: isMobile ? 'none' : '0 8px 32px rgba(0, 0, 0, 0.15)',
              border: isMobile ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
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
                        {pageContext?.type === 'tender' && pageContext.id 
                          ? `İhale ${(() => {
                              // external_id varsa ve timestamp değilse (10 haneden küçükse) kullan
                              const extId = pageContext.data?.external_id;
                              if (extId && String(extId).length < 12 && String(extId).includes('/')) {
                                return extId;
                              }
                              // Title'dan EKAP numarasını parse et (örn: "2025/2427594 - Yemek...")
                              const title = pageContext.data?.title || pageContext.title || '';
                              const match = title.match(/^(\d{4}\/\d+)/);
                              if (match) return match[1];
                              return '#' + pageContext.id;
                            })()}` 
                          : pageContext?.type === 'invoice' && pageContext.id
                          ? `Fatura #${pageContext.id}`
                          : pageContext?.type === 'cari' && pageContext.id
                          ? `Cari #${pageContext.id}`
                          : pathname.split('/').pop() || 'Genel'} sayfası
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

