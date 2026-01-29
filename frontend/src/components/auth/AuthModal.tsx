'use client';

import { Box, Drawer, Modal, Transition } from '@mantine/core';
import { useResponsive } from '@/hooks/useResponsive';
import { ForgotPasswordStep } from './steps/ForgotPasswordStep';
import { LoginStep } from './steps/LoginStep';
import { useAuthModal } from './useAuthModal';

export function AuthModal() {
  const { isOpen, closeModal, currentStep, setStep } = useAuthModal();
  const { isMobile } = useResponsive();

  const handleSuccess = () => {
    closeModal();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'login':
        return <LoginStep onSuccess={handleSuccess} onStepChange={setStep} />;
      case 'forgot-password':
        return <ForgotPasswordStep onStepChange={setStep} />;
      default:
        return <LoginStep onSuccess={handleSuccess} onStepChange={setStep} />;
    }
  };

  // Mobilde Drawer kullan, desktop'ta Modal
  if (isMobile) {
    return (
      <Drawer
        opened={isOpen}
        onClose={closeModal}
        position="bottom"
        size="auto"
        padding={0}
        withCloseButton={false}
        classNames={{
          overlay: 'auth-modal-overlay',
          content: 'auth-modal-content',
        }}
        styles={{
          content: {
            borderRadius: '24px 24px 0 0',
            maxHeight: '95vh',
            overflow: 'hidden',
          },
          body: {
            padding: 0,
          },
        }}
        transitionProps={{
          transition: 'slide-up',
          duration: 400,
          timingFunction: 'ease-out',
        }}
      >
        <Box pos="relative" style={{ overflow: 'hidden' }}>
          {/* Animated gradient background */}
          <Box className="auth-modal-gradient-bg" />

          {/* Animated blobs */}
          <Box className="auth-modal-blob auth-modal-blob-1" />
          <Box className="auth-modal-blob auth-modal-blob-2" />

          {/* Content */}
          <Box pos="relative" p="xl" style={{ zIndex: 1 }}>
            <Transition mounted={true} transition="fade" duration={300} timingFunction="ease">
              {(styles) => <Box style={styles}>{renderStep()}</Box>}
            </Transition>
          </Box>
        </Box>
      </Drawer>
    );
  }

  return (
    <Modal
      opened={isOpen}
      onClose={closeModal}
      centered
      size={450}
      padding={0}
      withCloseButton={false}
      classNames={{
        overlay: 'auth-modal-overlay',
        content: 'auth-modal-content',
      }}
      styles={{
        content: {
          overflow: 'hidden',
        },
        body: {
          padding: 0,
        },
      }}
      transitionProps={{
        transition: 'pop',
        duration: 300,
        timingFunction: 'ease-out',
      }}
    >
      <Box pos="relative" style={{ overflow: 'hidden' }}>
        {/* Animated gradient background */}
        <Box className="auth-modal-gradient-bg" />

        {/* Animated blobs */}
        <Box className="auth-modal-blob auth-modal-blob-1" />
        <Box className="auth-modal-blob auth-modal-blob-2" />
        <Box className="auth-modal-blob auth-modal-blob-3" />

        {/* Content */}
        <Box pos="relative" p="xl" style={{ zIndex: 1 }}>
          <Transition mounted={true} transition="fade" duration={300} timingFunction="ease">
            {(styles) => <Box style={styles}>{renderStep()}</Box>}
          </Transition>
        </Box>
      </Box>
    </Modal>
  );
}
