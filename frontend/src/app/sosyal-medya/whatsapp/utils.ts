export const commonEmojis = [
  '😀',
  '😂',
  '🥰',
  '😍',
  '🤩',
  '😎',
  '🤔',
  '😅',
  '👍',
  '👎',
  '👏',
  '🙏',
  '💪',
  '🤝',
  '✌️',
  '👋',
  '❤️',
  '💕',
  '💯',
  '🔥',
  '⭐',
  '✨',
  '🎉',
  '🎊',
  '✅',
  '❌',
  '⚠️',
  '📌',
  '📎',
  '📝',
  '📅',
  '⏰',
  '🍽️',
  '🍴',
  '🥗',
  '🍲',
  '🍛',
  '🥘',
  '🍜',
  '🍝',
];

export function formatRecordingTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
