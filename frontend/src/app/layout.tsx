import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import './globals.css';
import { MantineProvider, ColorSchemeScript, Container, Box } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Navbar } from '@/components/Navbar';
import { ClientLayout } from '@/components/ClientLayout';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'Catering Pro - İhale Yönetim Sistemi',
  description: 'AI destekli ihale analiz ve yönetim platformu',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
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
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            headings: {
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              fontWeight: '700',
            },
          }}
        >
          <AuthProvider>
            <Notifications position="top-right" />
            <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
              <Navbar />
              <Box component="main" className="main-content" style={{ flex: 1 }}>
                <ClientLayout>
                {children}
                </ClientLayout>
              </Box>
            </Box>
          </AuthProvider>
        </MantineProvider>
      </body>
    </html>
  );
}