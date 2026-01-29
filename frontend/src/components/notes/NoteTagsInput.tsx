'use client';

import { Loader, TagsInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconTag } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { notesAPI } from '@/lib/api/services/notes';
import type { NoteTag } from '@/types/notes';

interface NoteTagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  maxTags?: number;
}

export function NoteTagsInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'Etiket ekle...',
  maxTags = 10,
}: NoteTagsInputProps) {
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch suggestions based on search
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 1) {
      // Fetch popular tags when no query
      setLoading(true);
      try {
        const res = await notesAPI.getTagSuggestions();
        setSuggestions(res.suggestions?.map((t: NoteTag) => t.name) ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await notesAPI.getTagSuggestions(query);
      setSuggestions(res.suggestions?.map((t: NoteTag) => t.name) ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on search change
  useEffect(() => {
    fetchSuggestions(debouncedSearch);
  }, [debouncedSearch, fetchSuggestions]);

  // Initial fetch
  useEffect(() => {
    fetchSuggestions('');
  }, [fetchSuggestions]);

  // Filter out already selected tags from suggestions
  const filteredSuggestions = suggestions.filter((s) => !value.includes(s));

  return (
    <TagsInput
      value={value}
      onChange={onChange}
      data={filteredSuggestions}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      placeholder={placeholder}
      disabled={disabled}
      maxTags={maxTags}
      leftSection={<IconTag size={16} />}
      rightSection={loading ? <Loader size="xs" /> : null}
      clearable
      acceptValueOnBlur
      splitChars={[',', ' ']}
      styles={{
        pill: {
          backgroundColor: 'var(--mantine-color-blue-1)',
          color: 'var(--mantine-color-blue-7)',
        },
      }}
    />
  );
}

export default NoteTagsInput;
