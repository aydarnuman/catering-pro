'use client';

import { FloatingAIChat } from './FloatingAIChat';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <>
      {children}
      <FloatingAIChat />
    </>
  );
}
