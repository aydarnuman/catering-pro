'use client';

import { createContext, type ReactNode, useCallback, useState } from 'react';
import { AuthModal } from './AuthModal';

export type AuthStep = 'login' | 'forgot-password';

export interface AuthModalContextType {
  isOpen: boolean;
  currentStep: AuthStep;
  openModal: (step?: AuthStep) => void;
  closeModal: () => void;
  setStep: (step: AuthStep) => void;
}

export const AuthModalContext = createContext<AuthModalContextType | null>(null);

interface AuthModalProviderProps {
  children: ReactNode;
}

export function AuthModalProvider({ children }: AuthModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<AuthStep>('login');

  const openModal = useCallback((step: AuthStep = 'login') => {
    setCurrentStep(step);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    // Reset step after close animation
    setTimeout(() => {
      setCurrentStep('login');
    }, 300);
  }, []);

  const setStep = useCallback((step: AuthStep) => {
    setCurrentStep(step);
  }, []);

  return (
    <AuthModalContext.Provider
      value={{
        isOpen,
        currentStep,
        openModal,
        closeModal,
        setStep,
      }}
    >
      {children}
      <AuthModal />
    </AuthModalContext.Provider>
  );
}
