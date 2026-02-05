/**
 * Basic Component Tests
 * Mantine Button component test örneği
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider, Button } from '@mantine/core';

// Test wrapper with Mantine provider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('Button Component', () => {
  it('should render button with text', () => {
    render(
      <TestWrapper>
        <Button>Test Button</Button>
      </TestWrapper>
    );

    expect(screen.getByRole('button')).toHaveTextContent('Test Button');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();

    render(
      <TestWrapper>
        <Button onClick={handleClick}>Click Me</Button>
      </TestWrapper>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <TestWrapper>
        <Button disabled>Disabled Button</Button>
      </TestWrapper>
    );

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should show loading state', () => {
    render(
      <TestWrapper>
        <Button loading>Loading Button</Button>
      </TestWrapper>
    );

    // Loading state'de button tıklanamaz olmalı
    expect(screen.getByRole('button')).toHaveAttribute('data-loading', 'true');
  });
});
