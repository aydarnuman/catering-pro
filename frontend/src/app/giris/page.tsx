'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Group,
  Divider,
  Alert,
  Container,
  Center,
  rem,
  ThemeIcon,
  Anchor
} from '@mantine/core';
import { 
  IconAt, 
  IconLock, 
  IconAlertCircle, 
  IconChefHat,
  IconArrowRight,
  IconShieldCheck
} from '@tabler/icons-react';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Zaten giriş yapmışsa ana sayfaya yönlendir
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <Center h="100vh">
        <Text>Yükleniyor...</Text>
      </Center>
    );
  }

  if (isAuthenticated) {
    return (
      <Center h="100vh">
        <Text>Yönlendiriliyor...</Text>
      </Center>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !password) {
      setError('Email ve şifre gereklidir');
      setIsLoading(false);
      return;
    }

    const result = await login(email, password);
    
    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Giriş başarısız');
    }
    
    setIsLoading(false);
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: rem(20)
      }}
    >
      {/* Background decoration */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none'
        }}
      >
        <Box
          style={{
            position: 'absolute',
            top: '10%',
            left: '10%',
            width: rem(300),
            height: rem(300),
            background: 'radial-gradient(circle, rgba(34, 139, 230, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(60px)'
          }}
        />
        <Box
          style={{
            position: 'absolute',
            bottom: '20%',
            right: '15%',
            width: rem(250),
            height: rem(250),
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(50px)'
          }}
        />
      </Box>

      <Container size="xs" style={{ position: 'relative', zIndex: 1 }}>
        <Paper
          p="xl"
          radius="lg"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
        >
          <Stack gap="lg">
            {/* Logo & Header */}
            <Center>
              <Stack align="center" gap="md">
                <img 
                  src="/logo.png" 
                  alt="Catering Pro Logo" 
                  style={{ 
                    height: 80, 
                    width: 'auto',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 10px 30px rgba(34, 139, 230, 0.3))'
                  }} 
                />
                <Text size="sm" c="dimmed" ta="center">
                  İş Yönetim Sistemine Hoş Geldiniz
                </Text>
              </Stack>
            </Center>

            <Divider
              label={<Text size="xs" c="dimmed">Giriş Yap</Text>}
              labelPosition="center"
              style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
            />

            {/* Error Alert */}
            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                variant="light"
                title="Hata"
                radius="md"
              >
                {error}
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <TextInput
                  label={<Text size="sm" fw={500} c="gray.3">Email</Text>}
                  placeholder="ornek@sirket.com"
                  leftSection={<IconAt size={16} style={{ color: 'var(--mantine-color-gray-5)' }} />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  size="md"
                  radius="md"
                  styles={{
                    input: {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      '&::placeholder': {
                        color: 'var(--mantine-color-gray-6)'
                      },
                      '&:focus': {
                        borderColor: 'var(--mantine-color-blue-5)'
                      }
                    }
                  }}
                />

                <PasswordInput
                  label={<Text size="sm" fw={500} c="gray.3">Şifre</Text>}
                  placeholder="••••••••"
                  leftSection={<IconLock size={16} style={{ color: 'var(--mantine-color-gray-5)' }} />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  size="md"
                  radius="md"
                  styles={{
                    input: {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      '&:focus': {
                        borderColor: 'var(--mantine-color-blue-5)'
                      }
                    },
                    innerInput: {
                      color: 'white'
                    }
                  }}
                />

                <Button
                  type="submit"
                  fullWidth
                  size="md"
                  radius="md"
                  loading={isLoading}
                  rightSection={<IconArrowRight size={18} />}
                  variant="gradient"
                  gradient={{ from: 'blue.6', to: 'cyan.5', deg: 135 }}
                  style={{
                    marginTop: rem(8),
                    boxShadow: '0 4px 20px -4px rgba(34, 139, 230, 0.4)'
                  }}
                >
                  Giriş Yap
                </Button>
              </Stack>
            </form>

            {/* Footer Info */}
            <Stack gap="xs" mt="md">
              <Group justify="center" gap="xs">
                <IconShieldCheck size={14} style={{ color: 'var(--mantine-color-green-5)' }} />
                <Text size="xs" c="dimmed">
                  SSL ile güvenli bağlantı
                </Text>
              </Group>
              <Text size="xs" c="dimmed" ta="center">
                Hesabınız yok mu? Yöneticinizle iletişime geçin.
              </Text>
            </Stack>
          </Stack>
        </Paper>

        {/* Demo credentials (development only) */}
        <Paper
          mt="md"
          p="sm"
          radius="md"
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}
        >
          <Text size="xs" c="blue.3" fw={500} mb={4}>
            🧪 Demo Giriş Bilgileri
          </Text>
          <Text size="xs" c="gray.5">
            Email: <Text span c="white" ff="monospace">admin@catering.com</Text>
          </Text>
          <Text size="xs" c="gray.5">
            Şifre: <Text span c="white" ff="monospace">Admin123!</Text>
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}

