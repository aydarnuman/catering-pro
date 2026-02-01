'use client';

import React, { Component, ReactNode } from 'react';
import { Alert, Box, Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box p="xl">
          <Alert
            icon={<IconAlertTriangle size={24} />}
            title={this.props.fallbackTitle || 'Beklenmeyen Hata'}
            color="red"
            variant="filled"
            radius="md"
          >
            <Stack gap="md">
              <Text size="sm" c="white">
                {this.props.fallbackMessage || 
                 'Bu bölümde bir hata oluştu. Sayfayı yenilemeyi deneyin.'}
              </Text>
              
              {process.env.NODE_ENV === 'development' && (
                <Box>
                  <Text size="xs" fw={600} c="white" mb="xs">
                    Hata Detayı:
                  </Text>
                  <Text size="xs" c="white" style={{ fontFamily: 'monospace' }}>
                    {this.state.error?.message}
                  </Text>
                </Box>
              )}

              <Group gap="sm">
                <Button
                  variant="white"
                  color="red"
                  size="sm"
                  leftSection={<IconRefresh size={16} />}
                  onClick={this.handleReset}
                >
                  Tekrar Dene
                </Button>
                <Button
                  variant="outline"
                  color="white"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Sayfayı Yenile
                </Button>
              </Group>
            </Stack>
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Functional component wrapper for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}