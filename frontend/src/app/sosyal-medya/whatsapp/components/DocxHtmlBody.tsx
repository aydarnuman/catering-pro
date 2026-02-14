/** Renders sanitized docx HTML from mammoth. Sandboxed in modal. */
export function DocxHtmlBody({ html }: { html: string }) {
  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: mammoth produces sanitized HTML for docx rendering
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        color: '#333',
        fontSize: 14,
        lineHeight: 1.6,
      }}
    />
  );
}
