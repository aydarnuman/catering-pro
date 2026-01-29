'use client';

import { Alert, Box, Button, Stack, Text, TextInput } from '@mantine/core';
import { IconArrowLeft, IconAt, IconCheck, IconInfoCircle } from '@tabler/icons-react';
import { useState } from 'react';
import type { AuthStep } from '../AuthModalProvider';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ForgotPasswordStepProps {
  onStepChange?: (step: AuthStep) => void;
}

export function ForgotPasswordStep({ onStepChange }: ForgotPasswordStepProps) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Email validation
  const validateEmail = (emailValue: string): boolean => {
    return EMAIL_REGEX.test(emailValue);
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    if (!email) {
      setEmailError('Email adresi gereklidir');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Geçerli bir email adresi girin');
      return;
    }

    setIsLoading(true);

    // Simulate API call (backend doesn't have email service yet)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsLoading(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <Stack gap="lg">
        {/* Back Button */}
        <button
          type="button"
          className="auth-link"
          onClick={() => onStepChange?.('login')}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <IconArrowLeft size={16} />
          Giriş sayfasına dön
        </button>

        {/* Success State */}
        <Stack gap="md" align="center" py="lg">
          <Box
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconCheck size={32} style={{ color: '#22c55e' }} />
          </Box>

          <Stack gap="xs" align="center">
            <Text className="auth-title" style={{ fontSize: 20 }}>
              E-posta Gönderildi
            </Text>
            <Text className="auth-subtitle" ta="center">
              Şifre sıfırlama talimatları <strong>{email}</strong> adresine gönderildi.
            </Text>
          </Stack>

          <Alert icon={<IconInfoCircle size={16} />} className="auth-alert-info" radius="md">
            <Text size="sm">
              E-postayı almadıysanız spam klasörünüzü kontrol edin veya yöneticinizle iletişime
              geçin.
            </Text>
          </Alert>

          <Button
            fullWidth
            size="md"
            radius="md"
            className="auth-button"
            onClick={() => onStepChange?.('login')}
            mt="md"
          >
            Giriş Sayfasına Dön
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* Back Button */}
      <button
        type="button"
        className="auth-link"
        onClick={() => onStepChange?.('login')}
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <IconArrowLeft size={16} />
        Geri
      </button>

      {/* Header */}
      <Stack gap="xs" align="center">
        <Text className="auth-title">Şifre Sıfırlama</Text>
        <Text className="auth-subtitle" ta="center">
          E-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.
        </Text>
      </Stack>

      {/* Info Alert */}
      <Alert icon={<IconInfoCircle size={16} />} className="auth-alert-info" radius="md">
        <Text size="sm">
          Bu özellik henüz aktif değildir. Şifrenizi sıfırlamak için lütfen yöneticinizle iletişime
          geçin.
        </Text>
      </Alert>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* Email Input */}
          <Box>
            <Text className="auth-label" component="label" htmlFor="forgot-email">
              E-posta
            </Text>
            <Box className="auth-input-wrapper">
              <IconAt size={16} className="auth-input-icon" />
              <TextInput
                id="forgot-email"
                placeholder="E-posta adresinizi girin"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                error={emailError}
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

          {/* Submit Button */}
          <Button
            type="submit"
            fullWidth
            size="md"
            radius="md"
            loading={isLoading}
            className="auth-button"
            mt={8}
          >
            {isLoading ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder'}
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
