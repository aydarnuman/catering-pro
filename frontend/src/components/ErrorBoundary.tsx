'use client';

import {
  Alert,
  Box,
  Button,
  Code,
  Collapse,
  Container,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconHome,
  IconRefresh,
} from '@tabler/icons-react';
import Link from 'next/link';
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

/**
 * Error Boundary Component
 * React component hatalarını yakalar ve kullanıcı dostu bir hata sayfası gösterir
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Hata callback'i varsa çağır
    this.props.onError?.(error, errorInfo);

    // Console'a logla (development'ta)
    if (process.env.NODE_ENV === 'development') {
      console.error('🔴 ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }

    // Production'da error tracking servisine gönder (örn: Sentry)
    // if (process.env.NODE_ENV === 'production') {
    //   Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    // }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback varsa kullan
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Varsayılan hata UI'ı
      return (
        <Container size="sm" py={60}>
          <Stack align="center" gap="lg">
            <ThemeIcon size={80} radius="xl" color="red" variant="light">
              <IconAlertTriangle size={40} />
            </ThemeIcon>

            <Title order={2} ta="center">
              Bir Şeyler Yanlış Gitti
            </Title>

            <Text c="dimmed" ta="center" maw={500}>
              Beklenmeyen bir hata oluştu. Sayfayı yenileyerek tekrar deneyebilir veya ana sayfaya
              dönebilirsiniz.
            </Text>

            <Alert color="red" variant="light" title="Hata Mesajı" w="100%" maw={500}>
              {this.state.error?.message || 'Bilinmeyen hata'}
            </Alert>

            <Stack gap="sm" w="100%" maw={400}>
              <Button leftSection={<IconRefresh size={16} />} onClick={this.handleReset} fullWidth>
                Tekrar Dene
              </Button>

              <Button
                variant="light"
                leftSection={<IconHome size={16} />}
                component={Link}
                href="/"
                fullWidth
              >
                Ana Sayfaya Dön
              </Button>
            </Stack>

            {/* Geliştirici detayları (development'ta) */}
            {process.env.NODE_ENV === 'development' && (
              <Box w="100%" maw={600}>
                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  onClick={this.toggleDetails}
                  rightSection={
                    this.state.showDetails ? (
                      <IconChevronUp size={14} />
                    ) : (
                      <IconChevronDown size={14} />
                    )
                  }
                  fullWidth
                >
                  {this.state.showDetails ? 'Detayları Gizle' : 'Geliştirici Detayları'}
                </Button>

                <Collapse in={this.state.showDetails}>
                  <Stack gap="xs" mt="sm">
                    <Text size="xs" fw={600}>
                      Error Stack:
                    </Text>
                    <Code block style={{ fontSize: '10px', maxHeight: 200, overflow: 'auto' }}>
                      {this.state.error?.stack}
                    </Code>

                    {this.state.errorInfo?.componentStack && (
                      <>
                        <Text size="xs" fw={600}>
                          Component Stack:
                        </Text>
                        <Code block style={{ fontSize: '10px', maxHeight: 200, overflow: 'auto' }}>
                          {this.state.errorInfo.componentStack}
                        </Code>
                      </>
                    )}
                  </Stack>
                </Collapse>
              </Box>
            )}
          </Stack>
        </Container>
      );
    }

    return this.props.children;
  }
}

/**
 * API Error Fallback Component
 * API hataları için özel fallback
 */
interface ApiErrorFallbackProps {
  error?: Error | null;
  message?: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export function ApiErrorFallback({
  error,
  message = 'Veri yüklenirken bir hata oluştu',
  onRetry,
  showRetry = true,
}: ApiErrorFallbackProps) {
  // 401 hatası için özel mesaj
  const is401 = error?.message?.includes('401') || error?.message?.includes('Unauthorized');
  const is404 = error?.message?.includes('404') || error?.message?.includes('Not Found');
  const is500 = error?.message?.includes('500') || error?.message?.includes('Server Error');

  let displayMessage = message;
  let severity: 'warning' | 'error' = 'error';

  if (is401) {
    displayMessage = 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.';
    severity = 'warning';
  } else if (is404) {
    displayMessage = 'İstenen kaynak bulunamadı.';
  } else if (is500) {
    displayMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
  }

  return (
    <Alert
      color={severity === 'warning' ? 'yellow' : 'red'}
      variant="light"
      title={severity === 'warning' ? 'Uyarı' : 'Hata'}
      icon={<IconAlertTriangle size={16} />}
    >
      <Stack gap="xs">
        <Text size="sm">{displayMessage}</Text>
        {showRetry && onRetry && (
          <Button
            size="xs"
            variant="light"
            color={severity === 'warning' ? 'yellow' : 'red'}
            leftSection={<IconRefresh size={14} />}
            onClick={onRetry}
          >
            Tekrar Dene
          </Button>
        )}
        {is401 && (
          <Button size="xs" variant="light" color="blue" component={Link} href="/giris">
            Giriş Yap
          </Button>
        )}
      </Stack>
    </Alert>
  );
}

export default ErrorBoundary;
