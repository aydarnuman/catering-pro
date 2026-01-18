'use client';

import {
  Badge,
  Box,
  Center,
  Group,
  Kbd,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconArrowRight,
  IconFileText,
  IconHistory,
  IconPackage,
  IconReceipt,
  IconSearch,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

interface SearchResult {
  id: number;
  title: string;
  type: string;
  [key: string]: any;
}

interface SearchResults {
  tenders: SearchResult[];
  cariler: SearchResult[];
  invoices: SearchResult[];
  stok: SearchResult[];
  personel: SearchResult[];
  totalCount: number;
}

interface SearchModalProps {
  opened: boolean;
  onClose: () => void;
}

const categoryConfig = {
  tenders: {
    label: 'İhaleler',
    icon: IconFileText,
    color: 'blue',
    path: '/tenders',
  },
  cariler: {
    label: 'Cariler',
    icon: IconUsers,
    color: 'teal',
    path: '/muhasebe/cariler',
  },
  invoices: {
    label: 'Faturalar',
    icon: IconReceipt,
    color: 'orange',
    path: '/muhasebe/faturalar',
  },
  stok: {
    label: 'Stok',
    icon: IconPackage,
    color: 'grape',
    path: '/muhasebe/stok',
  },
  personel: {
    label: 'Personel',
    icon: IconUser,
    color: 'cyan',
    path: '/muhasebe/personel',
  },
};

export function SearchModal({ opened, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (opened) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery('');
      setResults(null);
    }
  }, [opened]);

  // Debounced search
  const searchDebounceRef = useRef<NodeJS.Timeout>();

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/search?q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      const data = await response.json();

      if (data.success) {
        setResults(data.results);
      }
    } catch (error) {
      console.error('Arama hatası:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      handleSearch(query);
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [query, handleSearch]);

  // Save to recent searches
  const saveRecentSearch = (term: string) => {
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Navigate to result
  const handleResultClick = (category: keyof typeof categoryConfig, item: SearchResult) => {
    saveRecentSearch(query);
    onClose();

    const config = categoryConfig[category];
    let path = config.path;

    // Add ID for detail pages
    if (category === 'tenders') {
      path = `/tenders/${item.id}`;
    } else if (category === 'cariler') {
      path = `/muhasebe/cariler?id=${item.id}`;
    }

    router.push(path);
  };

  // Handle recent search click
  const handleRecentClick = (term: string) => {
    setQuery(term);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!opened) {
          // This would need to be handled by parent
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened]);

  const hasResults = results && results.totalCount > 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      padding={0}
      radius="lg"
      withCloseButton={false}
      styles={{
        content: {
          backgroundColor: isDark ? 'rgba(26, 27, 30, 0.95)' : 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        },
        body: {
          padding: 0,
        },
      }}
    >
      {/* Search Input */}
      <Box
        p="md"
        style={{
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        }}
      >
        <TextInput
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          placeholder="İhale, cari, fatura, stok ara..."
          size="lg"
          leftSection={loading ? <Loader size={20} /> : <IconSearch size={20} />}
          rightSection={
            <Kbd size="sm" style={{ opacity: 0.5 }}>
              ESC
            </Kbd>
          }
          variant="unstyled"
          styles={{
            input: {
              fontSize: '1.1rem',
              '&::placeholder': {
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              },
            },
          }}
        />
      </Box>

      {/* Results */}
      <ScrollArea.Autosize mah={400}>
        <Box p="sm">
          {/* Recent Searches */}
          {!query && recentSearches.length > 0 && (
            <Stack gap="xs">
              <Group gap="xs" px="xs">
                <IconHistory size={14} style={{ opacity: 0.5 }} />
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Son Aramalar
                </Text>
              </Group>
              {recentSearches.map((term) => (
                <UnstyledButton
                  key={term}
                  onClick={() => handleRecentClick(term)}
                  px="sm"
                  py="xs"
                  style={{
                    borderRadius: 8,
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    },
                  }}
                >
                  <Group justify="space-between">
                    <Text size="sm">{term}</Text>
                    <IconArrowRight size={14} style={{ opacity: 0.3 }} />
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          )}

          {/* No Query State */}
          {!query && recentSearches.length === 0 && (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconSearch size={40} style={{ opacity: 0.2 }} />
                <Text c="dimmed" size="sm">
                  Aramak için yazmaya başlayın
                </Text>
              </Stack>
            </Center>
          )}

          {/* Loading */}
          {loading && query.length >= 2 && (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          )}

          {/* No Results */}
          {!loading && query.length >= 2 && results && results.totalCount === 0 && (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <IconSearch size={40} style={{ opacity: 0.2 }} />
                <Text c="dimmed" size="sm">
                  "{query}" için sonuç bulunamadı
                </Text>
              </Stack>
            </Center>
          )}

          {/* Results by Category */}
          {hasResults && (
            <Stack gap="md">
              {(Object.keys(categoryConfig) as Array<keyof typeof categoryConfig>).map(
                (category) => {
                  const items = results[category];
                  if (!items || items.length === 0) return null;

                  const config = categoryConfig[category];
                  const Icon = config.icon;

                  return (
                    <Box key={category}>
                      <Group gap="xs" px="xs" mb="xs">
                        <Icon size={14} style={{ opacity: 0.6 }} />
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                          {config.label}
                        </Text>
                        <Badge size="xs" variant="light" color={config.color}>
                          {items.length}
                        </Badge>
                      </Group>

                      <Stack gap={4}>
                        {items.map((item) => (
                          <UnstyledButton
                            key={item.id}
                            onClick={() => handleResultClick(category, item)}
                            px="sm"
                            py="xs"
                            style={{
                              borderRadius: 8,
                              transition: 'all 0.15s ease',
                              backgroundColor: 'transparent',
                            }}
                            className="search-result-item"
                          >
                            <Group justify="space-between" wrap="nowrap">
                              <Box style={{ flex: 1, minWidth: 0 }}>
                                <Text size="sm" fw={500} truncate>
                                  {item.title}
                                </Text>
                                {category === 'tenders' && item.city && (
                                  <Text size="xs" c="dimmed">
                                    {item.city} • {item.organization}
                                  </Text>
                                )}
                                {category === 'cariler' && item.tip && (
                                  <Text size="xs" c="dimmed">
                                    {item.tip} • {item.vergi_no}
                                  </Text>
                                )}
                                {category === 'invoices' && item.customer_name && (
                                  <Text size="xs" c="dimmed">
                                    {item.customer_name}
                                  </Text>
                                )}
                                {category === 'stok' && item.kategori && (
                                  <Text size="xs" c="dimmed">
                                    {item.kategori} • {item.kod}
                                  </Text>
                                )}
                                {category === 'personel' && item.departman && (
                                  <Text size="xs" c="dimmed">
                                    {item.departman} • {item.pozisyon}
                                  </Text>
                                )}
                              </Box>
                              <IconArrowRight size={16} style={{ opacity: 0.3, flexShrink: 0 }} />
                            </Group>
                          </UnstyledButton>
                        ))}
                      </Stack>
                    </Box>
                  );
                }
              )}
            </Stack>
          )}
        </Box>
      </ScrollArea.Autosize>

      {/* Footer */}
      <Box
        p="sm"
        style={{
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
        }}
      >
        <Group justify="space-between">
          <Group gap="lg">
            <Group gap={4}>
              <Kbd size="xs">↵</Kbd>
              <Text size="xs" c="dimmed">
                seç
              </Text>
            </Group>
            <Group gap={4}>
              <Kbd size="xs">↑↓</Kbd>
              <Text size="xs" c="dimmed">
                gezin
              </Text>
            </Group>
            <Group gap={4}>
              <Kbd size="xs">esc</Kbd>
              <Text size="xs" c="dimmed">
                kapat
              </Text>
            </Group>
          </Group>
          <Text size="xs" c="dimmed">
            {hasResults ? `${results.totalCount} sonuç` : 'Catering Pro'}
          </Text>
        </Group>
      </Box>
    </Modal>
  );
}
