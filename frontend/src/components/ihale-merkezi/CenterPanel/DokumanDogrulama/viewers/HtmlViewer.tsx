'use client';

import { Box, ScrollArea } from '@mantine/core';
import DOMPurify from 'dompurify';
import { useCallback, useMemo } from 'react';

interface HtmlViewerProps {
  /** HTML veya düz metin içerik */
  content: string;
  /** Text selection callback */
  onTextSelect?: (text: string) => void;
}

export function HtmlViewer({ content, onTextSelect }: HtmlViewerProps) {
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection?.toString().trim()) {
      onTextSelect?.(selection.toString().trim());
    }
  }, [onTextSelect]);

  // İçeriğin HTML mi yoksa düz metin mi olduğunu belirle
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  const sanitizedHtml = useMemo(() => {
    if (isHtml) {
      return DOMPurify.sanitize(content, {
        ALLOWED_TAGS: [
          'p',
          'br',
          'strong',
          'em',
          'b',
          'i',
          'u',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'ul',
          'ol',
          'li',
          'table',
          'thead',
          'tbody',
          'tr',
          'td',
          'th',
          'a',
          'span',
          'div',
          'pre',
          'code',
          'blockquote',
          'hr',
        ],
        ALLOWED_ATTR: ['href', 'target', 'class', 'style'],
      });
    }
    // Düz metni paragraflarla formatla
    return content
      .split('\n\n')
      .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }, [content, isHtml]);

  return (
    <ScrollArea style={{ height: '100%' }} onMouseUp={handleMouseUp}>
      <Box
        p="md"
        style={{
          maxWidth: 800,
          margin: '0 auto',
          fontSize: 14,
          lineHeight: 1.6,
        }}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized with DOMPurify
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </ScrollArea>
  );
}
