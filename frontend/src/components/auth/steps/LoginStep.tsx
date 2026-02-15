'use client';

import { Alert, Box, Button, Checkbox, Group, Select, Stack, Text, TextInput, Transition } from '@mantine/core';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconAt,
  IconBuilding,
  IconClock,
  IconEye,
  IconEyeOff,
  IconLock,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiBaseUrlDynamic } from '@/lib/config';
import type { AuthStep } from '../AuthModalProvider';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FirmaOption {
  id: number;
  unvan: string;
  kisa_ad: string | null;
}

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

  // Firma seçim state
  const [firmalar, setFirmalar] = useState<FirmaOption[]>([]);
  const [selectedFirmaId, setSelectedFirmaId] = useState<string | null>(null);
  const [showFirmaSelect, setShowFirmaSelect] = useState(false);
  const [firmaLoading, setFirmaLoading] = useState(false);
  const [credentialsValidated, setCredentialsValidated] = useState(false);

  // Error state
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  // UX state
  const [capsLockOn, setCapsLockOn] = useState(false);

  // Rate limiting state
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [lockCountdown, setLockCountdown] = useState<number>(0);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('remembered_email');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const validateEmail = (emailValue: string): boolean => {
    return EMAIL_REGEX.test(emailValue);
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const getApiUrl = () => {
    const base = getApiBaseUrlDynamic() || '';
    if (typeof window !== 'undefined' && base.startsWith(window.location.origin)) {
      return '';
    }
    return base;
  };

  /** Adım 1: Şifre doğrula → firma listesini al */
  const validateAndFetchFirmalar = async () => {
    setError('');
    setFirmaLoading(true);

    try {
      // Önce şifre doğrulama (firma_id olmadan login)
      const loginResult = await login(email, password);

      if (!loginResult.success) {
        const errorData = loginResult as Record<string, unknown>;
        if (errorData.code === 'ACCOUNT_LOCKED' && errorData.lockedUntil) {
          setLockedUntil(new Date(errorData.lockedUntil as string));
          setRemainingAttempts(0);
        } else if (typeof errorData.remainingAttempts === 'number') {
          setRemainingAttempts(errorData.remainingAttempts);
        }
        setError(loginResult.error || 'Giriş başarısız');
        return;
      }

      // Şifre doğru — firma listesini al
      setCredentialsValidated(true);

      const firmaRes = await fetch(`${getApiUrl()}/api/auth/firmalar`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const firmaData = await firmaRes.json();

      if (!firmaData.success || !firmaData.firmalar) {
        setError('Firma listesi alınamadı');
        return;
      }

      const userFirmalar: FirmaOption[] = firmaData.firmalar;

      if (userFirmalar.length === 0) {
        setError('Henüz bir firmaya atanmamışsınız. Lütfen yöneticinizle iletişime geçin.');
        return;
      }

      if (userFirmalar.length === 1) {
        // Tek firma — doğrudan o firma ile giriş yap
        await completeLoginWithFirma(userFirmalar[0].id);
        return;
      }

      // Birden fazla firma — dropdown göster
      setFirmalar(userFirmalar);
      setShowFirmaSelect(true);
    } catch (_err) {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setFirmaLoading(false);
    }
  };

  /** Adım 2: Seçilen firma ile switch-firma çağır */
  const completeLoginWithFirma = async (firmaId: number) => {
    try {
      const response = await fetch(`${getApiUrl()}/api/auth/switch-firma`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firma_id: firmaId }),
      });

      const data = await response.json();
      if (!data.success) {
        setError(data.error || 'Firma seçimi başarısız');
        return;
      }

      // Beni hatırla
      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
      } else {
        localStorage.removeItem('remembered_email');
      }

      // Firma bilgisini localStorage'a kaydet
      if (data.firma) {
        localStorage.setItem('selected_firma', JSON.stringify(data.firma));
      }

      onSuccess?.();
      window.location.reload();
    } catch (_err) {
      setError('Firma ile giriş yapılamadı.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailError('');

    if (lockCountdown > 0) return;

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
      if (showFirmaSelect && selectedFirmaId) {
        // Firma seçildi — giriş tamamla
        await completeLoginWithFirma(Number(selectedFirmaId));
      } else {
        // İlk adım — şifre doğrula ve firma listesini al
        await validateAndFetchFirmalar();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Email veya şifre değiştiğinde firma seçimini sıfırla
  const resetFirmaState = () => {
    if (showFirmaSelect) {
      setShowFirmaSelect(false);
      setFirmalar([]);
      setSelectedFirmaId(null);
      setCredentialsValidated(false);
    }
  };

  const getButtonText = () => {
    if (lockCountdown > 0) return `Kilitli (${formatCountdown(lockCountdown)})`;
    if (isLoading || firmaLoading) return 'Giriş yapılıyor...';
    if (showFirmaSelect) return 'Giriş Yap';
    return 'Devam Et';
  };

  return (
    <Stack gap="lg">
      {/* Header */}
      <Stack gap="xs" align="center">
        <Text className="auth-brand">Catering TR</Text>
        <Text className="auth-title">Tekrar Hoşgeldiniz</Text>
        <Text className="auth-subtitle">
          {showFirmaSelect ? 'Çalışmak istediğiniz firmayı seçin' : 'Hesabınıza giriş yapın'}
        </Text>
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
                  resetFirmaState();
                }}
                error={emailError}
                disabled={lockCountdown > 0 || credentialsValidated}
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  resetFirmaState();
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                disabled={lockCountdown > 0 || credentialsValidated}
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

          {/* Firma Select (2. adımda görünür) */}
          <Transition mounted={showFirmaSelect} transition="slide-down" duration={300}>
            {(transitionStyles) => (
              <Box style={transitionStyles}>
                <Text className="auth-label" component="label" htmlFor="login-firma">
                  Firma
                </Text>
                <Box className="auth-input-wrapper">
                  <IconBuilding size={16} className="auth-input-icon" />
                  <Select
                    id="login-firma"
                    placeholder="Çalışmak istediğiniz firmayı seçin"
                    data={(firmalar ?? []).map((f) => ({
                      value: String(f.id),
                      label: f.kisa_ad || f.unvan,
                    }))}
                    value={selectedFirmaId}
                    onChange={setSelectedFirmaId}
                    searchable={(firmalar ?? []).length > 5}
                    size="md"
                    radius="md"
                    classNames={{
                      input: 'auth-input',
                    }}
                    styles={{
                      input: {
                        paddingLeft: 40,
                      },
                    }}
                  />
                </Box>
              </Box>
            )}
          </Transition>

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
            <button type="button" className="auth-link" onClick={() => onStepChange?.('forgot-password')}>
              Şifremi unuttum
            </button>
          </Group>

          {/* Submit Button */}
          <Button
            type="submit"
            fullWidth
            size="md"
            radius="md"
            loading={isLoading || firmaLoading}
            disabled={lockCountdown > 0 || (showFirmaSelect && !selectedFirmaId)}
            className="auth-button"
            mt={8}
          >
            {getButtonText()}
          </Button>

          {/* Firma seçim aşamasında "Geri dön" linki */}
          {showFirmaSelect && (
            <Button
              variant="subtle"
              size="sm"
              fullWidth
              onClick={() => {
                setShowFirmaSelect(false);
                setFirmalar([]);
                setSelectedFirmaId(null);
                setCredentialsValidated(false);
                setError('');
              }}
            >
              Farklı hesapla giriş yap
            </Button>
          )}
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
