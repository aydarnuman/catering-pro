'use client';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Group,
  Stack,
  Text,
  TextInput,
  Transition,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconAt,
  IconClock,
  IconEye,
  IconEyeOff,
  IconLock,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { AuthStep } from '../AuthModalProvider';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginStepProps {
  onSuccess?: () => void;
  onStepChange?: (step: AuthStep) => void;
}

export function LoginStep({ onSuccess, onStepChange }: LoginStepProps) {
  const { login } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Error state
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  // UX state
  const [capsLockOn, setCapsLockOn] = useState(false);

  // Rate limiting state
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [lockCountdown, setLockCountdown] = useState<number>(0);

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

  // Format countdown time
  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
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

        // Başarılı giriş callback'i
        onSuccess?.();

        // Sayfayı yenile (token cookie'leri yüklendi)
        window.location.reload();
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

  return (
    <Stack gap="lg">
      {/* Header */}
      <Stack gap="xs" align="center">
        <Text className="auth-brand">Catering TR</Text>
        <Text className="auth-title">Tekrar Hoşgeldiniz</Text>
        <Text className="auth-subtitle">Hesabınıza giriş yapın</Text>
      </Stack>

      {/* Error/Lock Alert */}
      <Transition mounted={!!(error || lockCountdown > 0)} transition="slide-down" duration={300}>
        {(transitionStyles) => (
          <Alert
            style={transitionStyles}
            icon={lockCountdown > 0 ? <IconClock size={18} /> : <IconAlertCircle size={18} />}
            className={lockCountdown > 0 ? 'auth-alert-warning' : 'auth-alert'}
            title={lockCountdown > 0 ? 'Hesap Geçici Olarak Kilitli' : 'Giriş Başarısız'}
            radius="md"
          >
            <Stack gap={6}>
              <Text size="sm">{error}</Text>

              {lockCountdown > 0 && (
                <Group gap="xs" mt={4}>
                  <IconClock size={14} />
                  <Text size="sm" fw={600}>
                    Kalan süre: {formatCountdown(lockCountdown)}
                  </Text>
                </Group>
              )}

              {remainingAttempts !== null && remainingAttempts > 0 && remainingAttempts <= 3 && (
                <Group gap="xs" mt={2}>
                  <IconAlertTriangle size={14} />
                  <Text size="xs">Kalan deneme hakkı: {remainingAttempts}</Text>
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
          <Box>
            <Text className="auth-label" component="label" htmlFor="login-email">
              E-posta
            </Text>
            <Box className="auth-input-wrapper">
              <IconAt size={16} className="auth-input-icon" />
              <TextInput
                id="login-email"
                placeholder="E-posta adresinizi girin"
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
                classNames={{
                  input: `auth-input ${emailError ? 'auth-input-error' : ''}`,
                }}
                styles={{
                  input: {
                    paddingLeft: 40,
                  },
                }}
              />
            </Box>
            {emailError && (
              <Text size="xs" c="red.4" mt={4}>
                {emailError}
              </Text>
            )}
          </Box>

          {/* Password Input */}
          <Box>
            <Text className="auth-label" component="label" htmlFor="login-password">
              Şifre
            </Text>
            <Box className="auth-input-wrapper">
              <IconLock size={16} className="auth-input-icon" />
              <TextInput
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Şifrenizi girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                disabled={lockCountdown > 0}
                size="md"
                radius="md"
                autoComplete="current-password"
                classNames={{
                  input: 'auth-input has-right-icon',
                }}
                styles={{
                  input: {
                    paddingLeft: 40,
                    paddingRight: 44,
                  },
                }}
              />
              <button
                type="button"
                className="auth-input-right-icon"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </Box>

            {/* Caps Lock Warning */}
            <Transition mounted={capsLockOn} transition="slide-down" duration={200}>
              {(transitionStyles) => (
                <Group gap={4} mt={6} style={transitionStyles}>
                  <IconAlertTriangle size={12} style={{ color: '#fcd34d' }} />
                  <Text size="xs" style={{ color: '#fcd34d' }}>
                    Caps Lock açık
                  </Text>
                </Group>
              )}
            </Transition>
          </Box>

          {/* Remember Me & Forgot Password */}
          <Group justify="space-between" mt={2}>
            <Checkbox
              label={<Text className="auth-checkbox-label">Beni hatırla</Text>}
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.currentTarget.checked)}
              disabled={lockCountdown > 0}
              size="sm"
              classNames={{
                input: 'auth-checkbox',
              }}
            />
            <button
              type="button"
              className="auth-link"
              onClick={() => onStepChange?.('forgot-password')}
            >
              Şifremi unuttum
            </button>
          </Group>

          {/* Submit Button */}
          <Button
            type="submit"
            fullWidth
            size="md"
            radius="md"
            loading={isLoading}
            disabled={lockCountdown > 0}
            className="auth-button"
            mt={8}
          >
            {lockCountdown > 0
              ? `Kilitli (${formatCountdown(lockCountdown)})`
              : isLoading
                ? 'Giriş yapılıyor...'
                : 'Giriş Yap'}
          </Button>
        </Stack>
      </form>

      {/* SSL Indicator */}
      <Group justify="center" gap="xs" className="auth-ssl-indicator">
        <IconShieldCheck size={14} />
        <Text size="xs">256-bit SSL ile güvenli bağlantı</Text>
      </Group>
    </Stack>
  );
}
