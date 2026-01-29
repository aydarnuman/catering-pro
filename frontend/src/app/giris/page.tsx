'use client';

import {
  Alert,
  Anchor,
  Box,
  Button,
  Center,
  Checkbox,
  Container,
  Divider,
  Group,
  Loader,
  Paper,
  PasswordInput,
  rem,
  Stack,
  Text,
  TextInput,
  Transition,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconAt,
  IconClock,
  IconLock,
  IconShieldCheck,
} from '@tabler/icons-react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const redirectTo = searchParams.get('redirect') || '/';
  const hasRedirected = useRef(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Error state
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  // UX state
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Rate limiting state
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [lockCountdown, setLockCountdown] = useState<number>(0);

  // Mount animasyonu için
  useEffect(() => {
    setMounted(true);
  }, []);

  // Hatırlanan email'i yükle
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('remembered_email');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  // Kilit süresini countdown olarak göster
  useEffect(() => {
    if (!lockedUntil) {
      setLockCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const diff = Math.max(0, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
      setLockCountdown(diff);

      if (diff === 0) {
        setLockedUntil(null);
        setError('');
        setRemainingAttempts(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  // Zaten giriş yapmışsa yönlendir
  useEffect(() => {
    if (pathname !== '/giris' || hasRedirected.current) return;
    if (authLoading) return;

    if (isAuthenticated) {
      hasRedirected.current = true;
      const target = redirectTo.startsWith('/') ? redirectTo : '/';
      router.replace(target);
    }
  }, [authLoading, isAuthenticated, router, pathname, redirectTo]);

  // Caps Lock handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  // Email validation
  const validateEmail = (emailValue: string): boolean => {
    return EMAIL_REGEX.test(emailValue);
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');

    // Kilit kontrolü
    if (lockCountdown > 0) {
      return;
    }

    // Validation
    if (!email || !password) {
      setError('Email ve şifre gereklidir');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Geçerli bir email adresi girin');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        // Beni hatırla
        if (rememberMe) {
          localStorage.setItem('remembered_email', email);
        } else {
          localStorage.removeItem('remembered_email');
        }

        hasRedirected.current = true;
        const target = redirectTo.startsWith('/') ? redirectTo : '/';
        window.location.href = target;
      } else {
        // Backend response'dan detayları al
        const errorData = result as any;

        if (errorData.code === 'ACCOUNT_LOCKED' && errorData.lockedUntil) {
          setLockedUntil(new Date(errorData.lockedUntil));
          setRemainingAttempts(0);
        } else if (errorData.remainingAttempts !== undefined) {
          setRemainingAttempts(errorData.remainingAttempts);
        }

        setError(result.error || 'Giriş başarısız');
        setIsLoading(false);
      }
    } catch (_err) {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      setIsLoading(false);
    }
  };

  // Format countdown time
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Loading state - geliştirilmiş
  if (authLoading) {
    return (
      <Box
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack align="center" gap="md">
          <Loader size="lg" color="blue" type="dots" />
          <Text c="dimmed" size="sm">
            Oturum kontrol ediliyor...
          </Text>
        </Stack>
      </Box>
    );
  }

  // Authenticated ise redirect bekle
  if (isAuthenticated && !hasRedirected.current) {
    return (
      <Box
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Stack align="center" gap="md">
          <Loader size="lg" color="green" type="dots" />
          <Text c="dimmed" size="sm">
            Yönlendiriliyor...
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: rem(20),
        overflowX: 'hidden',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Animated background decorations */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/* Sol üst glow */}
        <Box
          style={{
            position: 'absolute',
            top: '5%',
            left: '5%',
            width: rem(400),
            height: rem(400),
            background: 'radial-gradient(circle, rgba(34, 139, 230, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(80px)',
            animation: 'pulse 8s ease-in-out infinite',
          }}
        />
        {/* Sağ alt glow */}
        <Box
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '10%',
            width: rem(350),
            height: rem(350),
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(70px)',
            animation: 'pulse 10s ease-in-out infinite reverse',
          }}
        />
        {/* Orta glow */}
        <Box
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: rem(600),
            height: rem(600),
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.05) 0%, transparent 60%)',
            borderRadius: '50%',
            filter: 'blur(100px)',
          }}
        />
      </Box>

      {/* CSS Animation */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <Transition mounted={mounted} transition="fade" duration={500}>
        {(styles) => (
          <Container size="xs" style={{ ...styles, position: 'relative', zIndex: 1 }}>
            <Paper
              p="xl"
              radius="lg"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow:
                  '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
                animation: 'fadeInUp 0.6s ease-out',
              }}
            >
              <Stack gap="lg">
                {/* Logo & Header */}
                <Center>
                  <Stack align="center" gap="md">
                    <Box
                      style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: 280,
                        padding: rem(24),
                        borderRadius: rem(16),
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        boxShadow:
                          '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 120,
                      }}
                    >
                      {/* Subtle glow effect */}
                      <Box
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '100%',
                          height: '100%',
                          background:
                            'radial-gradient(circle, rgba(34, 139, 230, 0.15) 0%, transparent 70%)',
                          borderRadius: rem(16),
                          zIndex: 0,
                        }}
                      />
                      <Box
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Image
                          src="/logo-transparent.png"
                          alt="Catering Pro Logo"
                          width={200}
                          height={80}
                          style={{
                            height: 'auto',
                            width: '100%',
                            maxWidth: 200,
                            maxHeight: 80,
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2))',
                          }}
                          priority
                          unoptimized
                        />
                      </Box>
                    </Box>
                    <Text size="sm" c="dimmed" ta="center">
                      İş Yönetim Sistemine Hoş Geldiniz
                    </Text>
                  </Stack>
                </Center>

                <Divider
                  label={
                    <Text size="xs" c="dimmed" fw={500}>
                      Giriş Yap
                    </Text>
                  }
                  labelPosition="center"
                  style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
                />

                {/* Error/Lock Alert */}
                <Transition
                  mounted={!!(error || lockCountdown > 0)}
                  transition="slide-down"
                  duration={300}
                >
                  {(transitionStyles) => (
                    <Alert
                      style={transitionStyles}
                      icon={
                        lockCountdown > 0 ? <IconClock size={18} /> : <IconAlertCircle size={18} />
                      }
                      color={lockCountdown > 0 ? 'orange' : 'red'}
                      variant="light"
                      title={lockCountdown > 0 ? 'Hesap Geçici Olarak Kilitli' : 'Giriş Başarısız'}
                      radius="md"
                      styles={{
                        root: {
                          backgroundColor:
                            lockCountdown > 0
                              ? 'rgba(251, 146, 60, 0.1)'
                              : 'rgba(239, 68, 68, 0.1)',
                          borderColor:
                            lockCountdown > 0
                              ? 'rgba(251, 146, 60, 0.3)'
                              : 'rgba(239, 68, 68, 0.3)',
                        },
                      }}
                    >
                      <Stack gap={6}>
                        <Text size="sm">{error}</Text>

                        {lockCountdown > 0 && (
                          <Group gap="xs" mt={4}>
                            <IconClock
                              size={14}
                              style={{ color: 'var(--mantine-color-orange-5)' }}
                            />
                            <Text size="sm" fw={600} c="orange.4">
                              Kalan süre: {formatCountdown(lockCountdown)}
                            </Text>
                          </Group>
                        )}

                        {remainingAttempts !== null &&
                          remainingAttempts > 0 &&
                          remainingAttempts <= 3 && (
                            <Group gap="xs" mt={2}>
                              <IconAlertTriangle
                                size={14}
                                style={{ color: 'var(--mantine-color-yellow-5)' }}
                              />
                              <Text size="xs" c="yellow.5">
                                Kalan deneme hakkı: {remainingAttempts}
                              </Text>
                            </Group>
                          )}
                      </Stack>
                    </Alert>
                  )}
                </Transition>

                {/* Login Form */}
                <form onSubmit={handleSubmit}>
                  <Stack gap="md">
                    {/* Email Input */}
                    <TextInput
                      label={
                        <Text size="sm" fw={500} c="gray.3">
                          Email
                        </Text>
                      }
                      placeholder="ornek@sirket.com"
                      leftSection={
                        <IconAt size={16} style={{ color: 'var(--mantine-color-gray-5)' }} />
                      }
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError('');
                      }}
                      error={emailError}
                      disabled={lockCountdown > 0}
                      size="md"
                      radius="md"
                      autoComplete="email"
                      styles={{
                        input: {
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderColor: emailError
                            ? 'var(--mantine-color-red-6)'
                            : 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          transition: 'all 0.2s ease',
                          '&::placeholder': {
                            color: 'var(--mantine-color-gray-6)',
                          },
                          '&:focus': {
                            borderColor: 'var(--mantine-color-blue-5)',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 0 0 2px rgba(34, 139, 230, 0.2)',
                          },
                          '&:disabled': {
                            opacity: 0.5,
                          },
                        },
                      }}
                    />

                    {/* Password Input */}
                    <Box>
                      <PasswordInput
                        label={
                          <Text size="sm" fw={500} c="gray.3">
                            Şifre
                          </Text>
                        }
                        placeholder="••••••••"
                        leftSection={
                          <IconLock size={16} style={{ color: 'var(--mantine-color-gray-5)' }} />
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onKeyUp={handleKeyUp}
                        disabled={lockCountdown > 0}
                        size="md"
                        radius="md"
                        autoComplete="current-password"
                        styles={{
                          input: {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            transition: 'all 0.2s ease',
                            '&:focus': {
                              borderColor: 'var(--mantine-color-blue-5)',
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              boxShadow: '0 0 0 2px rgba(34, 139, 230, 0.2)',
                            },
                            '&:disabled': {
                              opacity: 0.5,
                            },
                          },
                          innerInput: {
                            color: 'white',
                          },
                        }}
                      />
                      {/* Caps Lock Warning */}
                      <Transition mounted={capsLockOn} transition="slide-down" duration={200}>
                        {(transitionStyles) => (
                          <Group gap={4} mt={6} style={transitionStyles}>
                            <IconAlertTriangle
                              size={12}
                              style={{ color: 'var(--mantine-color-yellow-5)' }}
                            />
                            <Text size="xs" c="yellow.5">
                              Caps Lock açık
                            </Text>
                          </Group>
                        )}
                      </Transition>
                    </Box>

                    {/* Remember Me & Forgot Password */}
                    <Group justify="space-between" mt={2}>
                      <Checkbox
                        label={
                          <Text size="sm" c="gray.4">
                            Beni hatırla
                          </Text>
                        }
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.currentTarget.checked)}
                        disabled={lockCountdown > 0}
                        size="sm"
                        styles={{
                          input: {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            cursor: 'pointer',
                            '&:checked': {
                              backgroundColor: 'var(--mantine-color-blue-6)',
                              borderColor: 'var(--mantine-color-blue-6)',
                            },
                          },
                          label: {
                            cursor: 'pointer',
                          },
                        }}
                      />
                      <Anchor
                        component="button"
                        type="button"
                        size="sm"
                        c="blue.4"
                        style={{
                          transition: 'color 0.2s ease',
                        }}
                        onClick={() => {
                          // TODO: Şifre sıfırlama sayfası veya modal
                          alert(
                            'Şifre sıfırlama özelliği yakında eklenecek. Lütfen yöneticinizle iletişime geçin.'
                          );
                        }}
                      >
                        Şifremi unuttum
                      </Anchor>
                    </Group>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      fullWidth
                      size="md"
                      radius="md"
                      loading={isLoading}
                      disabled={lockCountdown > 0}
                      rightSection={!isLoading && !lockCountdown && <IconArrowRight size={18} />}
                      variant="gradient"
                      gradient={{ from: 'blue.6', to: 'cyan.5', deg: 135 }}
                      style={{
                        marginTop: rem(8),
                        boxShadow:
                          lockCountdown > 0 ? 'none' : '0 4px 20px -4px rgba(34, 139, 230, 0.4)',
                        opacity: lockCountdown > 0 ? 0.6 : 1,
                        transition: 'all 0.3s ease',
                      }}
                      styles={{
                        root: {
                          '&:hover:not(:disabled)': {
                            transform: 'translateY(-1px)',
                            boxShadow: '0 6px 25px -4px rgba(34, 139, 230, 0.5)',
                          },
                          '&:active:not(:disabled)': {
                            transform: 'translateY(0)',
                          },
                        },
                      }}
                    >
                      {lockCountdown > 0
                        ? `Kilitli (${formatCountdown(lockCountdown)})`
                        : isLoading
                          ? 'Giriş yapılıyor...'
                          : 'Giriş Yap'}
                    </Button>
                  </Stack>
                </form>

                {/* Footer Info */}
                <Stack gap="xs" mt="md">
                  <Group justify="center" gap="xs">
                    <IconShieldCheck size={14} style={{ color: 'var(--mantine-color-green-5)' }} />
                    <Text size="xs" c="dimmed">
                      256-bit SSL ile güvenli bağlantı
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" ta="center">
                    Hesabınız yok mu?{' '}
                    <Text span c="blue.4" style={{ cursor: 'pointer' }}>
                      Yöneticinizle iletişime geçin
                    </Text>
                  </Text>
                </Stack>
              </Stack>
            </Paper>

            {/* Version info */}
            <Text size="xs" c="dimmed" ta="center" mt="lg" style={{ opacity: 0.5 }}>
              Catering Pro v2.0
            </Text>
          </Container>
        )}
      </Transition>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Box
          style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Stack align="center" gap="md">
            <Loader size="lg" color="blue" type="dots" />
            <Text c="dimmed" size="sm">
              Yükleniyor...
            </Text>
          </Stack>
        </Box>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
