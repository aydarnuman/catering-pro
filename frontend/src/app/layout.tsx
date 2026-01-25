import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import './globals.css';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Providers } from '@/components/Providers';
import { AppLayout } from '@/components/AppLayout';

export const metadata = {
  title: 'Catering Pro - İhale Yönetim Sistemi',
  description: 'AI destekli ihale analiz ve yönetim platformu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>
        <MantineProvider
          theme={{
            primaryColor: 'blue',
            defaultRadius: 'md',
            colors: {
              blue: [
                '#e7f5ff',
                '#d0ebff',
                '#a5d8ff',
                '#74c0fc',
                '#4dabf7',
                '#339af0',
                '#228be6',
                '#1c7ed6',
                '#1971c2',
                '#1864ab',
              ],
            },
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            headings: {
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontWeight: '700',
            },
          }}
        >
          <Providers>
            <AppLayout>{children}</AppLayout>
          </Providers>
        </MantineProvider>
      </body>
    </html>
  );
}
