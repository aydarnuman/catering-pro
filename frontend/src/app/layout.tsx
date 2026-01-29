import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import './globals.css';
import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppLayout } from '@/components/AppLayout';
import { Providers } from '@/components/Providers';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata = {
  title: 'Catering Pro - İhale Yönetim Sistemi',
  description: 'AI destekli ihale analiz ve yönetim platformu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning data-mantine-color-scheme="dark">
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <MantineProvider
          forceColorScheme="dark"
          theme={{
            primaryColor: 'blue',
            defaultRadius: 'md',
            colors: {
              blue: [
                '#eff6ff',
                '#dbeafe',
                '#bfdbfe',
                '#93c5fd',
                '#60a5fa',
                '#3b82f6',
                '#2563eb',
                '#1d4ed8',
                '#1e40af',
                '#1e3a8a',
              ],
              yellow: [
                '#fefce8',
                '#fef9c3',
                '#fef08a',
                '#fde047',
                '#facc15',
                '#e6c530',
                '#ca8a04',
                '#a16207',
                '#854d0e',
                '#713f12',
              ],
              dark: [
                '#ffffff',
                '#a1a1aa',
                '#71717a',
                '#52525b',
                '#3f3f46',
                '#2d2d32',
                '#27272a',
                '#1e1e24',
                '#18181b',
                '#09090b',
              ],
            },
            fontFamily:
              'var(--font-geist-sans), "Geist", -apple-system, BlinkMacSystemFont, sans-serif',
            fontFamilyMonospace: 'var(--font-geist-mono), "Geist Mono", ui-monospace, monospace',
            headings: {
              fontFamily:
                'var(--font-geist-sans), "Geist", -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: '700',
            },
            other: {
              cardBg: '#2d2d32',
              inputBg: '#1e1e24',
              borderSubtle: 'rgba(255, 255, 255, 0.08)',
              borderLight: 'rgba(255, 255, 255, 0.12)',
            },
            components: {
              Paper: {
                defaultProps: {
                  bg: '#252529',
                },
                styles: {
                  root: {
                    backgroundColor: '#252529',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  },
                },
              },
              Card: {
                defaultProps: {
                  bg: '#252529',
                },
                styles: {
                  root: {
                    backgroundColor: '#252529',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)',
                    },
                  },
                },
              },
              Modal: {
                styles: {
                  content: {
                    backgroundColor: '#1c1c20',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  },
                  header: {
                    backgroundColor: '#1c1c20',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '16px 20px',
                  },
                  title: {
                    fontWeight: 600,
                    fontSize: '16px',
                  },
                  body: {
                    padding: '20px',
                  },
                },
              },
              TextInput: {
                styles: {
                  input: {
                    backgroundColor: '#1e1e24',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    '&:focus': {
                      borderColor: '#3b82f6',
                    },
                  },
                },
              },
              Textarea: {
                styles: {
                  input: {
                    backgroundColor: '#1e1e24',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    '&:focus': {
                      borderColor: '#3b82f6',
                    },
                  },
                },
              },
              NumberInput: {
                styles: {
                  input: {
                    backgroundColor: '#1e1e24',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    '&:focus': {
                      borderColor: '#3b82f6',
                    },
                  },
                },
              },
              Select: {
                styles: {
                  input: {
                    backgroundColor: '#1e1e24',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    '&:focus': {
                      borderColor: '#3b82f6',
                    },
                  },
                  dropdown: {
                    backgroundColor: '#2d2d32',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                },
              },
              MultiSelect: {
                styles: {
                  input: {
                    backgroundColor: '#1e1e24',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                  dropdown: {
                    backgroundColor: '#2d2d32',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                },
              },
              PasswordInput: {
                styles: {
                  input: {
                    backgroundColor: '#1e1e24',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                },
              },
              DateInput: {
                styles: {
                  input: {
                    backgroundColor: '#1e1e24',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                },
              },
              DatePickerInput: {
                styles: {
                  input: {
                    backgroundColor: '#1e1e24',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                },
              },
              Button: {
                styles: {
                  root: {
                    // Default variant styling handled via CSS variables
                  },
                },
              },
              Menu: {
                styles: {
                  dropdown: {
                    backgroundColor: '#2d2d32',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                  item: {
                    '&:hover': {
                      backgroundColor: '#3f3f46',
                    },
                  },
                },
              },
              Popover: {
                styles: {
                  dropdown: {
                    backgroundColor: '#2d2d32',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                },
              },
              Tooltip: {
                styles: {
                  tooltip: {
                    backgroundColor: '#2d2d32',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                },
              },
              Table: {
                styles: {
                  table: {
                    '& thead tr th': {
                      backgroundColor: '#1e1e24',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#a1a1aa',
                      fontWeight: 600,
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '12px 16px',
                    },
                    '& tbody tr td': {
                      borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                      padding: '14px 16px',
                    },
                    '& tbody tr:hover': {
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    },
                    '& tbody tr:nth-of-type(even)': {
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    },
                  },
                },
              },
              Drawer: {
                styles: {
                  content: {
                    backgroundColor: '#2d2d32',
                  },
                  header: {
                    backgroundColor: '#2d2d32',
                  },
                },
              },
              Accordion: {
                styles: {
                  item: {
                    backgroundColor: '#2d2d32',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                },
              },
              Radio: {
                styles: {
                  radio: {
                    backgroundColor: '#1e1e24',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    '&:checked': {
                      backgroundColor: '#3b82f6',
                      borderColor: '#3b82f6',
                    },
                  },
                },
              },
              Checkbox: {
                styles: {
                  input: {
                    backgroundColor: '#1e1e24',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    '&:checked': {
                      backgroundColor: '#3b82f6',
                      borderColor: '#3b82f6',
                    },
                  },
                },
              },
              Switch: {
                styles: {
                  track: {
                    backgroundColor: '#3f3f46',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                },
              },
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
