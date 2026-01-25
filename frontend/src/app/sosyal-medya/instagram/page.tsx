'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  FileInput,
  Grid,
  Group,
  Image,
  Loader,
  Modal,
  Paper,
  Progress,
  RingProgress,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
  Alert,
  Indicator,
  Menu,
  rem,
  NumberInput,
  Popover,
  Transition,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { DateTimePicker, TimeInput } from '@mantine/dates';
import {
  IconBrandInstagram,
  IconCamera,
  IconCheck,
  IconHeart,
  IconHeartFilled,
  IconMessageCircle,
  IconPhoto,
  IconPlug,
  IconPlugOff,
  IconRefresh,
  IconSend,
  IconSettings,
  IconUpload,
  IconX,
  IconCalendar,
  IconClock,
  IconHash,
  IconSparkles,
  IconRobot,
  IconChartBar,
  IconTrendingUp,
  IconEye,
  IconBookmark,
  IconShare,
  IconDots,
  IconTrash,
  IconCopy,
  IconExternalLink,
  IconChefHat,
  IconTemplate,
  IconPalette,
  IconWand,
  IconBolt,
  IconPlayerPlay,
  IconCirclePlus,
  IconMessageDots,
  IconAt,
  IconBell,
  IconHistory,
  IconReportAnalytics,
  IconMessages,
  IconUserPlus,
  IconDownload,
  IconPlus,
  IconChevronRight,
  IconSearch,
  IconTarget,
  IconActivity,
  IconLoader,
  IconArrowRight,
} from '@tabler/icons-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/config';

// ==================== TYPES ====================

interface InstagramAccount {
  id: string;
  username: string;
  full_name: string;
  profile_pic?: string;
  followers: number;
  following: number;
  posts: number;
  isConnected: boolean;
  platform: 'instagram';
}

interface Post {
  id: string;
  code: string;
  caption: string;
  likes: number;
  comments: number;
  media_type: number;
  thumbnail: string | null;
  timestamp: string | null;
}

interface DM {
  thread_id: string;
  users: string[];
  last_message: string | null;
  timestamp: string | null;
  unread: boolean;
}

interface DMMessage {
  id: string;
  text: string;
  timestamp: string | null;
  user_id: string;
  is_me: boolean;
}

interface AutomationTask {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  schedule?: string;
  lastRun?: Date;
  stats?: { totalRuns: number; successRate: number };
}

interface AgentLog {
  id: string;
  taskId: string;
  taskName: string;
  action: string;
  status: 'success' | 'error' | 'running';
  message: string;
  timestamp: Date;
}

// ==================== API FUNCTIONS ====================

const checkInstagramStatus = async () => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/status`);
  if (!res.ok) throw new Error('Instagram servisi yanıt vermiyor');
  return res.json();
};

const loginInstagram = async (username: string, password: string, verificationCode?: string) => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, verification_code: verificationCode }),
  });
  if (!res.ok) throw new Error('Login başarısız');
  return res.json();
};

const logoutInstagram = async () => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/logout`, { method: 'POST' });
  if (!res.ok) throw new Error('Logout başarısız');
  return res.json();
};

const getProfile = async () => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/profile`);
  if (!res.ok) throw new Error('Profil alınamadı');
  return res.json();
};

const getPosts = async (limit = 20) => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/posts?limit=${limit}`);
  if (!res.ok) throw new Error('Gönderiler alınamadı');
  return res.json();
};

const getDMs = async () => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/dms`);
  if (!res.ok) throw new Error('Mesajlar alınamadı');
  return res.json();
};

const getDMMessages = async (threadId: string) => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/dms/${threadId}?limit=50`);
  if (!res.ok) throw new Error('Mesajlar alınamadı');
  return res.json();
};

const uploadPost = async (file: File, caption: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('caption', caption);
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/posts/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Gönderi paylaşılamadı');
  return res.json();
};

// AI Functions
const generateCaptionFromImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('style', 'professional');
  formData.append('includeEmoji', 'true');
  formData.append('includeHashtags', 'true');
  formData.append('businessName', 'Degsan Yemek');
  formData.append('businessType', 'catering');
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/ai/caption`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Caption üretilemedi');
  return res.json();
};

const generateHashtagsFromCaption = async (caption: string) => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/ai/hashtags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caption, count: 12, city: 'ankara', businessType: 'catering' }),
  });
  if (!res.ok) throw new Error('Hashtag üretilemedi');
  return res.json();
};

const generateImagePrompt = async (description: string) => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/ai/image-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, style: 'professional', type: 'food' }),
  });
  if (!res.ok) throw new Error('Prompt oluşturulamadı');
  return res.json();
};

const generateAIImage = async (prompt: string, negativePrompt?: string) => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/ai/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, negativePrompt, aspectRatio: '1:1' }),
  });
  if (!res.ok) throw new Error('Görsel üretilemedi');
  return res.json();
};

const generateMenuCard = async (menu: { name: string; emoji?: string }[], template: string = 'modern') => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/ai/menu-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      menu, template, 
      businessName: 'Degsan Yemek',
      date: new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }),
    }),
  });
  if (!res.ok) throw new Error('Menü kartı oluşturulamadı');
  return res.json();
};

const sendDMMessage = async (threadId: string, message: string) => {
  const res = await fetch(`${API_BASE_URL}/api/social/instagram/dms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, message }),
  });
  if (!res.ok) throw new Error('Mesaj gönderilemedi');
  return res.json();
};

// ==================== COMPONENT ====================

export default function InstagramPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const queryClient = useQueryClient();

  // ===== ACCOUNTS STATE =====
  const [accounts, setAccounts] = useState<InstagramAccount[]>([
    {
      id: '1',
      username: 'degsan.yemek',
      full_name: 'Hezar Dinari Yurt Müdürlüğü Yemek İşletmesi',
      profile_pic: undefined,
      followers: 688,
      following: 23,
      posts: 77,
      isConnected: true,
      platform: 'instagram',
    },
  ]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('1');
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  // Modal States
  const [addAccountModal, { open: openAddAccount, close: closeAddAccount }] = useDisclosure(false);
  const [newPostModal, { open: openNewPost, close: closeNewPost }] = useDisclosure(false);
  const [postDetailModal, { open: openPostDetail, close: closePostDetail }] = useDisclosure(false);
  const [dmModal, { open: openDM, close: closeDM }] = useDisclosure(false);
  const [aiToolsModal, { open: openAITools, close: closeAITools }] = useDisclosure(false);
  const [automationModal, { open: openAutomation, close: closeAutomation }] = useDisclosure(false);
  const [twoFactorModal, { open: openTwoFactor, close: closeTwoFactor }] = useDisclosure(false);

  // Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [isGeneratingHashtags, setIsGeneratingHashtags] = useState(false);
  
  // AI Image States
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState<{ prompt: string; negative_prompt: string } | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Menu Card States
  const [menuCardTemplate, setMenuCardTemplate] = useState('modern');
  const [menuCardItems] = useState([
    { name: 'Mercimek Çorbası', emoji: '🥣' },
    { name: 'Izgara Tavuk', emoji: '🍗' },
    { name: 'Pilav', emoji: '🍚' },
    { name: 'Salata', emoji: '🥗' },
  ]);
  const [isGeneratingMenuCard, setIsGeneratingMenuCard] = useState(false);
  const [menuCardHtml, setMenuCardHtml] = useState<string | null>(null);

  // Post & DM States
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedDM, setSelectedDM] = useState<DM | null>(null);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSendingDM, setIsSendingDM] = useState(false);

  // Automation Tasks
  const [automationTasks, setAutomationTasks] = useState<AutomationTask[]>([
    { id: 'daily-menu', name: 'Günlük Menü Paylaşımı', description: 'Her gün 11:00\'de menü paylaş', icon: <IconChefHat size={18} />, enabled: true, schedule: 'Her gün 11:00', stats: { totalRuns: 45, successRate: 98 } },
    { id: 'dm-auto-reply', name: 'DM Otomatik Yanıt', description: 'Gelen DM\'lere AI yanıt', icon: <IconMessageDots size={18} />, enabled: true, schedule: 'Anlık', stats: { totalRuns: 156, successRate: 94 } },
    { id: 'welcome-follower', name: 'Yeni Takipçi Hoş Geldin', description: 'Yeni takipçilere mesaj', icon: <IconUserPlus size={18} />, enabled: false, schedule: 'Anlık', stats: { totalRuns: 89, successRate: 100 } },
    { id: 'comment-reply', name: 'Yorum Yanıtlama', description: 'Yorumları AI ile yanıtla', icon: <IconMessages size={18} />, enabled: false, schedule: 'Anlık', stats: { totalRuns: 234, successRate: 91 } },
    { id: 'weekly-report', name: 'Haftalık Rapor', description: 'Performans raporu hazırla', icon: <IconReportAnalytics size={18} />, enabled: true, schedule: 'Pazartesi 09:00', stats: { totalRuns: 12, successRate: 100 } },
    { id: 'hashtag-research', name: 'Hashtag Araştırması', description: 'Trend hashtag analizi', icon: <IconHash size={18} />, enabled: false, schedule: 'Her gün 08:00', stats: { totalRuns: 30, successRate: 100 } },
    { id: 'competitor-watch', name: 'Rakip Takibi', description: 'Rakip paylaşımlarını izle', icon: <IconTarget size={18} />, enabled: false, schedule: 'Her 6 saat', stats: { totalRuns: 120, successRate: 95 } },
    { id: 'engagement-boost', name: 'Etkileşim Artırıcı', description: 'En iyi saat analizii', icon: <IconTrendingUp size={18} />, enabled: true, schedule: 'Her gün', stats: { totalRuns: 60, successRate: 100 } },
  ]);

  // Agent Logs
  const [agentLogs] = useState<AgentLog[]>([
    { id: '1', taskId: 'daily-menu', taskName: 'Günlük Menü', action: 'Post paylaşıldı', status: 'success', message: 'Menü görseli oluşturuldu ve paylaşıldı', timestamp: new Date(Date.now() - 3600000) },
    { id: '2', taskId: 'dm-auto-reply', taskName: 'DM Yanıt', action: 'Mesaj gönderildi', status: 'success', message: '@user123\'e fiyat bilgisi gönderildi', timestamp: new Date(Date.now() - 7200000) },
    { id: '3', taskId: 'dm-auto-reply', taskName: 'DM Yanıt', action: 'Mesaj analizi', status: 'running', message: 'Gelen mesaj analiz ediliyor...', timestamp: new Date() },
    { id: '4', taskId: 'weekly-report', taskName: 'Haftalık Rapor', action: 'Rapor oluşturuldu', status: 'success', message: 'PDF rapor hazırlandı ve mail gönderildi', timestamp: new Date(Date.now() - 604800000) },
  ]);

  // Quick Reply Templates
  const quickReplies = [
    { label: 'Fiyat Bilgisi', text: 'Merhaba! Fiyat bilgisi için lütfen kişi sayısı ve tarih belirtir misiniz?' },
    { label: 'Menü Gönder', text: 'Güncel menümüzü ve fiyat listemizi ekte bulabilirsiniz.' },
    { label: 'Randevu', text: 'Tadım randevusu için uygun olduğunuz gün ve saati belirtir misiniz?' },
    { label: 'Teşekkür', text: 'Teşekkür ederiz! Bizi tercih ettiğiniz için çok mutluyuz.' },
  ];

  // ===== STYLES =====
  const cardStyle = {
    background: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  };

  const subtleText = { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' };

  // ===== QUERIES =====
  const { data: statusData, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useQuery({
    queryKey: ['instagram-status', selectedAccountId],
    queryFn: checkInstagramStatus,
    refetchInterval: 30000,
    retry: 1,
  });

  const isConnected = statusData?.connected === true;
  const currentUser = statusData?.user;

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['instagram-profile', selectedAccountId],
    queryFn: getProfile,
    enabled: isConnected,
  });

  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } = useQuery({
    queryKey: ['instagram-posts', selectedAccountId],
    queryFn: () => getPosts(12),
    enabled: isConnected,
  });

  const { data: dmsData, isLoading: dmsLoading, refetch: refetchDMs } = useQuery({
    queryKey: ['instagram-dms', selectedAccountId],
    queryFn: getDMs,
    enabled: isConnected,
  });

  const posts: Post[] = postsData?.posts || [];
  const dms: DM[] = dmsData?.dms || [];
  const profile = profileData?.profile || currentUser;

  // ===== MUTATIONS =====
  const loginMutation = useMutation({
    mutationFn: ({ username, password, code }: { username: string; password: string; code?: string }) => 
      loginInstagram(username, password, code),
    onSuccess: (data) => {
      if (data.success) {
        notifications.show({ title: 'Bağlantı Başarılı', message: `@${data.user?.username} hesabı bağlandı`, color: 'green' });
        closeTwoFactor();
        closeAddAccount();
        // Add new account
        if (data.user) {
          const newAccount: InstagramAccount = {
            id: Date.now().toString(),
            username: data.user.username,
            full_name: data.user.full_name || data.user.username,
            profile_pic: data.user.profile_pic,
            followers: data.user.followers || 0,
            following: data.user.following || 0,
            posts: data.user.posts || 0,
            isConnected: true,
            platform: 'instagram',
          };
          setAccounts(prev => [...prev, newAccount]);
          setSelectedAccountId(newAccount.id);
        }
        queryClient.invalidateQueries({ queryKey: ['instagram-status'] });
      } else if (data.error === 'two_factor_required') {
        openTwoFactor();
      } else {
        notifications.show({ title: 'Hata', message: data.error, color: 'red' });
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutInstagram,
    onSuccess: () => {
      notifications.show({ title: 'Çıkış Yapıldı', message: 'Hesap bağlantısı kesildi', color: 'gray' });
      setAccounts(prev => prev.map(a => a.id === selectedAccountId ? { ...a, isConnected: false } : a));
      queryClient.invalidateQueries({ queryKey: ['instagram-status'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, caption }: { file: File; caption: string }) => uploadPost(file, caption),
    onSuccess: (data) => {
      if (data.success) {
        notifications.show({ title: 'Paylaşıldı', message: 'Gönderiniz yayınlandı', color: 'green' });
        closeNewPost();
        setCaption('');
        setSelectedFile(null);
        queryClient.invalidateQueries({ queryKey: ['instagram-posts'] });
      }
    },
  });

  // ===== HELPER FUNCTIONS =====
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatTimestamp = (timestamp: string | Date | null): string => {
    if (!timestamp) return '';
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    if (days > 0) return `${days}g`;
    if (hours > 0) return `${hours}s`;
    if (minutes > 0) return `${minutes}dk`;
    return 'Az önce';
  };

  const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.comments, 0);
  const avgEngagement = posts.length > 0 ? ((totalLikes + totalComments) / posts.length / (profile?.followers || 1) * 100).toFixed(2) : '0';
  const unreadDMs = dms.filter(dm => dm.unread).length;
  const activeAutomations = automationTasks.filter(t => t.enabled).length;

  // ===== HANDLERS =====
  const loadDMMessages = async (threadId: string) => {
    try {
      const data = await getDMMessages(threadId);
      setDmMessages(data.messages || []);
    } catch (error) {
      console.error('DM messages error:', error);
    }
  };

  const handleSelectDM = (dm: DM) => {
    setSelectedDM(dm);
    loadDMMessages(dm.thread_id);
    openDM();
  };

  const handleSendDM = async () => {
    if (!newMessage.trim() || !selectedDM) return;
    setIsSendingDM(true);
    try {
      const result = await sendDMMessage(selectedDM.thread_id, newMessage);
      if (result.success) {
        notifications.show({ title: 'Gönderildi', message: 'Mesaj iletildi', color: 'green' });
        setNewMessage('');
        loadDMMessages(selectedDM.thread_id);
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Mesaj gönderilemedi', color: 'red' });
    } finally {
      setIsSendingDM(false);
    }
  };

  const handleGenerateCaption = async () => {
    if (!selectedFile) return;
    setIsGeneratingCaption(true);
    try {
      const result = await generateCaptionFromImage(selectedFile);
      if (result.success) {
        setCaption(result.caption);
        if (result.hashtagler) setSuggestedHashtags(result.hashtagler);
        notifications.show({ title: 'AI Caption Hazır', message: 'Açıklama oluşturuldu', color: 'green' });
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Caption üretilemedi', color: 'red' });
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleGenerateHashtags = async () => {
    if (!caption) return;
    setIsGeneratingHashtags(true);
    try {
      const result = await generateHashtagsFromCaption(caption);
      if (result.success && result.hashtagler) {
        setSuggestedHashtags(result.hashtagler);
        notifications.show({ title: 'Hashtag Hazır', message: `${result.hashtagler.length} öneri`, color: 'green' });
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Hashtag üretilemedi', color: 'red' });
    } finally {
      setIsGeneratingHashtags(false);
    }
  };

  const addHashtagToCaption = (tag: string) => {
    if (!caption.includes(`#${tag}`)) {
      setCaption(prev => prev + (prev ? ' ' : '') + `#${tag}`);
    }
  };

  const handleGenerateImagePrompt = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingPrompt(true);
    try {
      const result = await generateImagePrompt(imagePrompt);
      if (result.success) {
        setGeneratedPrompt({ prompt: result.prompt, negative_prompt: result.negative_prompt });
        notifications.show({ title: 'Prompt Hazır', message: 'Şimdi görsel üretebilirsiniz', color: 'green' });
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Prompt oluşturulamadı', color: 'red' });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!generatedPrompt?.prompt) return;
    setIsGeneratingImage(true);
    try {
      const result = await generateAIImage(generatedPrompt.prompt, generatedPrompt.negative_prompt);
      if (result.success) {
        setGeneratedImage(result.dataUrl);
        notifications.show({ title: 'Görsel Hazır', message: 'AI görsel üretildi', color: 'green' });
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Görsel üretilemedi', color: 'red' });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateMenuCard = async () => {
    setIsGeneratingMenuCard(true);
    try {
      const result = await generateMenuCard(menuCardItems, menuCardTemplate);
      if (result.success) {
        setMenuCardHtml(result.html);
        notifications.show({ title: 'Menü Kartı Hazır', message: 'Şablon oluşturuldu', color: 'green' });
      }
    } catch (error) {
      notifications.show({ title: 'Hata', message: 'Menü kartı oluşturulamadı', color: 'red' });
    } finally {
      setIsGeneratingMenuCard(false);
    }
  };

  const toggleAutomation = (taskId: string) => {
    setAutomationTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, enabled: !task.enabled } : task
    ));
    const task = automationTasks.find(t => t.id === taskId);
    notifications.show({
      title: task?.enabled ? 'Durduruldu' : 'Başlatıldı',
      message: task?.name,
      color: task?.enabled ? 'gray' : 'green',
    });
  };

  const runAutomationNow = (taskId: string) => {
    const task = automationTasks.find(t => t.id === taskId);
    if (!task) return;
    notifications.show({ title: 'Çalıştırılıyor', message: task.name, color: 'blue', loading: true, autoClose: 2000 });
  };

  // ===== ERROR STATE =====
  if (statusError) {
    return (
      <Box style={{ minHeight: '100vh', background: isDark ? '#0a0a0f' : '#fafbfc', paddingTop: 100, paddingBottom: 40 }}>
        <Container size="sm">
          <Paper p="xl" radius="lg" style={cardStyle}>
            <Stack align="center" gap="lg">
              <ThemeIcon size={60} radius="xl" color="red" variant="light"><IconPlugOff size={30} /></ThemeIcon>
              <Box ta="center">
                <Title order={3}>Servis Bağlanamıyor</Title>
                <Text size="sm" style={subtleText} mt="xs">Instagram servisi şu anda çalışmıyor</Text>
              </Box>
              <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => refetchStatus()}>
                Tekrar Dene
              </Button>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  // ===== LOADING STATE =====
  if (statusLoading) {
    return (
      <Box style={{ minHeight: '100vh', background: isDark ? '#0a0a0f' : '#fafbfc', paddingTop: 100, paddingBottom: 40 }}>
        <Container size="sm">
          <Paper p="xl" radius="lg" style={cardStyle}>
            <Stack align="center" gap="lg">
              <Loader size="lg" color="gray" />
              <Text style={subtleText}>Bağlantı kontrol ediliyor...</Text>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  // ===== MAIN RENDER =====
  return (
    <Box style={{ minHeight: '100vh', background: isDark ? '#0a0a0f' : '#fafbfc', paddingTop: 80, paddingBottom: 40 }}>
      <Container size="xl">
        
        {/* ===== HESAP SEÇİCİ ===== */}
        <Paper p="md" radius="lg" mb="md" style={cardStyle}>
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Text size="sm" fw={500} style={subtleText}>Hesaplar</Text>
              <Divider orientation="vertical" />
              <ScrollArea w={400} type="never">
                <Group gap="xs" wrap="nowrap">
                  {accounts.map((account) => (
                    <UnstyledButton
                      key={account.id}
                      onClick={() => setSelectedAccountId(account.id)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        background: selectedAccountId === account.id 
                          ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)')
                          : 'transparent',
                        border: selectedAccountId === account.id 
                          ? `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}` 
                          : '1px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Group gap="xs" wrap="nowrap">
                        <Indicator color={account.isConnected ? 'green' : 'gray'} size={8} offset={2} position="bottom-end">
                          <Avatar src={account.profile_pic} size={28} radius="xl">
                            {account.username[0].toUpperCase()}
                          </Avatar>
                        </Indicator>
                        <Box>
                          <Text size="xs" fw={500}>@{account.username}</Text>
                          <Text size="xs" style={subtleText}>{formatNumber(account.followers)} takipçi</Text>
                        </Box>
                      </Group>
                    </UnstyledButton>
                  ))}
                </Group>
              </ScrollArea>
            </Group>
            <Button 
              variant="subtle" 
              size="xs" 
              leftSection={<IconPlus size={14} />}
              onClick={openAddAccount}
            >
              Hesap Ekle
            </Button>
          </Group>
        </Paper>

        {/* ===== SEÇİLİ HESAP BİLGİSİ ===== */}
        {selectedAccount && (
          <Paper p="lg" radius="lg" mb="md" style={cardStyle}>
            <Group justify="space-between" align="flex-start">
              <Group gap="md">
                <Indicator color={selectedAccount.isConnected ? 'green' : 'gray'} size={12} offset={4} position="bottom-end" withBorder>
                  <Avatar 
                    src={profile?.profile_pic || selectedAccount.profile_pic} 
                    size={56} 
                    radius="xl"
                    imageProps={{ referrerPolicy: 'no-referrer' }}
                  >
                    {selectedAccount.username[0].toUpperCase()}
                  </Avatar>
                </Indicator>
                <Box>
                  <Group gap="xs" mb={2}>
                    <Text size="lg" fw={600}>{profile?.full_name || selectedAccount.full_name}</Text>
                    {selectedAccount.isConnected && (
                      <Badge size="xs" variant="light" color="green">Bağlı</Badge>
                    )}
                  </Group>
                  <Text size="sm" style={subtleText}>@{selectedAccount.username}</Text>
                  <Group gap="md" mt="xs">
                    <Text size="sm"><Text span fw={600}>{formatNumber(profile?.posts || selectedAccount.posts)}</Text> <Text span style={subtleText}>gönderi</Text></Text>
                    <Text size="sm"><Text span fw={600}>{formatNumber(profile?.followers || selectedAccount.followers)}</Text> <Text span style={subtleText}>takipçi</Text></Text>
                    <Text size="sm"><Text span fw={600}>{avgEngagement}%</Text> <Text span style={subtleText}>etkileşim</Text></Text>
                  </Group>
                </Box>
              </Group>
              
              <Group gap="xs">
                <Tooltip label="Yenile">
                  <ActionIcon variant="subtle" onClick={() => { refetchPosts(); refetchDMs(); }}>
                    <IconRefresh size={18} />
                  </ActionIcon>
                </Tooltip>
                <Button variant="light" size="sm" leftSection={<IconPlus size={16} />} onClick={openNewPost}>
                  Yeni Gönderi
                </Button>
                <Menu shadow="sm" width={180}>
                  <Menu.Target>
                    <ActionIcon variant="subtle"><IconDots size={18} /></ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconExternalLink size={14} />} component="a" href={`https://instagram.com/${selectedAccount.username}`} target="_blank">
                      Instagram'da Aç
                    </Menu.Item>
                    <Menu.Item leftSection={<IconSettings size={14} />}>Ayarlar</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item color="red" leftSection={<IconPlugOff size={14} />} onClick={() => logoutMutation.mutate()}>
                      Bağlantıyı Kes
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          </Paper>
        )}

        {/* ===== BENTO GRID ===== */}
        <Grid gutter="md">
          
          {/* Sol Kolon - Gönderiler + İstatistik */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="md">
              
              {/* Son Gönderiler */}
              <Paper p="lg" radius="lg" style={cardStyle}>
                <Group justify="space-between" mb="md">
                  <Text fw={500}>Son Gönderiler</Text>
                  <Button variant="subtle" size="xs" rightSection={<IconChevronRight size={14} />}>
                    Tümü
                  </Button>
                </Group>
                
                {postsLoading ? (
                  <SimpleGrid cols={4}>
                    {[...Array(8)].map((_, i) => <Skeleton key={i} height={100} radius="md" />)}
                  </SimpleGrid>
                ) : posts.length === 0 ? (
                  <Box ta="center" py="xl">
                    <Text style={subtleText}>Henüz gönderi yok</Text>
                  </Box>
                ) : (
                  <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs">
                    {posts.slice(0, 8).map((post) => (
                      <UnstyledButton 
                        key={post.id} 
                        onClick={() => { setSelectedPost(post); openPostDetail(); }}
                        style={{ borderRadius: 8, overflow: 'hidden', aspectRatio: '1/1', position: 'relative' }}
                      >
                        <Image 
                          src={post.thumbnail || 'https://placehold.co/200x200/1a1a1a/333?text=📷'} 
                          alt="" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                        <Box 
                          pos="absolute" 
                          bottom={0} 
                          left={0} 
                          right={0} 
                          p={6}
                          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}
                        >
                          <Group gap={6}>
                            <Group gap={2}>
                              <IconHeart size={10} color="white" />
                              <Text size="xs" c="white">{formatNumber(post.likes)}</Text>
                            </Group>
                          </Group>
                        </Box>
                      </UnstyledButton>
                    ))}
                  </SimpleGrid>
                )}
              </Paper>

              {/* İstatistikler */}
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                <Paper p="md" radius="lg" style={cardStyle}>
                  <Group gap="sm">
                    <ThemeIcon size={36} radius="md" variant="light" color="gray">
                      <IconHeart size={18} />
                    </ThemeIcon>
                    <Box>
                      <Text size="lg" fw={600}>{formatNumber(totalLikes)}</Text>
                      <Text size="xs" style={subtleText}>Beğeni</Text>
                    </Box>
                  </Group>
                </Paper>
                <Paper p="md" radius="lg" style={cardStyle}>
                  <Group gap="sm">
                    <ThemeIcon size={36} radius="md" variant="light" color="gray">
                      <IconMessageCircle size={18} />
                    </ThemeIcon>
                    <Box>
                      <Text size="lg" fw={600}>{formatNumber(totalComments)}</Text>
                      <Text size="xs" style={subtleText}>Yorum</Text>
                    </Box>
                  </Group>
                </Paper>
                <Paper p="md" radius="lg" style={cardStyle}>
                  <Group gap="sm">
                    <ThemeIcon size={36} radius="md" variant="light" color="gray">
                      <IconEye size={18} />
                    </ThemeIcon>
                    <Box>
                      <Text size="lg" fw={600}>{formatNumber((profile?.followers || 0) * 12)}</Text>
                      <Text size="xs" style={subtleText}>Görüntülenme</Text>
                    </Box>
                  </Group>
                </Paper>
                <Paper p="md" radius="lg" style={cardStyle}>
                  <Group gap="sm">
                    <ThemeIcon size={36} radius="md" variant="light" color="gray">
                      <IconTrendingUp size={18} />
                    </ThemeIcon>
                    <Box>
                      <Text size="lg" fw={600}>{avgEngagement}%</Text>
                      <Text size="xs" style={subtleText}>Etkileşim</Text>
                    </Box>
                  </Group>
                </Paper>
              </SimpleGrid>

              {/* Mesajlar */}
              <Paper p="lg" radius="lg" style={cardStyle}>
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <Text fw={500}>Mesajlar</Text>
                    {unreadDMs > 0 && <Badge size="sm" variant="light">{unreadDMs} yeni</Badge>}
                  </Group>
                  <Button variant="subtle" size="xs" rightSection={<IconChevronRight size={14} />}>
                    Tümü
                  </Button>
                </Group>
                
                {dmsLoading ? (
                  <Stack gap="xs">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} height={50} radius="md" />)}
                  </Stack>
                ) : dms.length === 0 ? (
                  <Box ta="center" py="lg">
                    <Text style={subtleText}>Mesaj yok</Text>
                  </Box>
                ) : (
                  <Stack gap="xs">
                    {dms.slice(0, 4).map((dm) => (
                      <UnstyledButton 
                        key={dm.thread_id} 
                        onClick={() => handleSelectDM(dm)}
                        style={{ 
                          display: 'block', 
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: dm.unread ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent',
                        }}
                      >
                        <Group>
                          <Indicator disabled={!dm.unread} color="blue" size={8}>
                            <Avatar radius="xl" size={36}>{dm.users[0]?.[0]?.toUpperCase()}</Avatar>
                          </Indicator>
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Group justify="space-between">
                              <Text size="sm" fw={dm.unread ? 600 : 400}>@{dm.users[0]}</Text>
                              <Text size="xs" style={subtleText}>{formatTimestamp(dm.timestamp)}</Text>
                            </Group>
                            <Text size="xs" style={subtleText} truncate>{dm.last_message || 'Mesaj yok'}</Text>
                          </Box>
                        </Group>
                      </UnstyledButton>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Stack>
          </Grid.Col>

          {/* Sağ Kolon - AI Araçları + Otomasyonlar */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              
              {/* AI Araçları */}
              <Paper p="lg" radius="lg" style={cardStyle}>
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size={24} radius="sm" variant="light" color="gray">
                      <IconSparkles size={14} />
                    </ThemeIcon>
                    <Text fw={500}>AI Araçları</Text>
                  </Group>
                  <Button variant="subtle" size="xs" onClick={openAITools}>Genişlet</Button>
                </Group>
                
                <Stack gap="xs">
                  <UnstyledButton 
                    onClick={openAITools}
                    style={{ 
                      padding: '12px',
                      borderRadius: 8,
                      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <Group gap="sm">
                      <IconCamera size={18} style={{ opacity: 0.6 }} />
                      <Box style={{ flex: 1 }}>
                        <Text size="sm" fw={500}>Görsel → Caption</Text>
                        <Text size="xs" style={subtleText}>Fotoğraftan açıklama üret</Text>
                      </Box>
                      <IconChevronRight size={14} style={{ opacity: 0.4 }} />
                    </Group>
                  </UnstyledButton>
                  
                  <UnstyledButton 
                    onClick={openAITools}
                    style={{ 
                      padding: '12px',
                      borderRadius: 8,
                      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <Group gap="sm">
                      <IconHash size={18} style={{ opacity: 0.6 }} />
                      <Box style={{ flex: 1 }}>
                        <Text size="sm" fw={500}>Akıllı Hashtag</Text>
                        <Text size="xs" style={subtleText}>Trend hashtag önerileri</Text>
                      </Box>
                      <IconChevronRight size={14} style={{ opacity: 0.4 }} />
                    </Group>
                  </UnstyledButton>
                  
                  <UnstyledButton 
                    onClick={openAITools}
                    style={{ 
                      padding: '12px',
                      borderRadius: 8,
                      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <Group gap="sm">
                      <IconPhoto size={18} style={{ opacity: 0.6 }} />
                      <Box style={{ flex: 1 }}>
                        <Text size="sm" fw={500}>AI Görsel Üret</Text>
                        <Text size="xs" style={subtleText}>Flux ile görsel oluştur</Text>
                      </Box>
                      <IconChevronRight size={14} style={{ opacity: 0.4 }} />
                    </Group>
                  </UnstyledButton>
                  
                  <UnstyledButton 
                    onClick={openAITools}
                    style={{ 
                      padding: '12px',
                      borderRadius: 8,
                      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <Group gap="sm">
                      <IconTemplate size={18} style={{ opacity: 0.6 }} />
                      <Box style={{ flex: 1 }}>
                        <Text size="sm" fw={500}>Menü Kartı</Text>
                        <Text size="xs" style={subtleText}>Şablondan menü oluştur</Text>
                      </Box>
                      <IconChevronRight size={14} style={{ opacity: 0.4 }} />
                    </Group>
                  </UnstyledButton>
                </Stack>
              </Paper>

              {/* Otomasyonlar */}
              <Paper p="lg" radius="lg" style={cardStyle}>
                <Group justify="space-between" mb="md">
                  <Group gap="xs">
                    <ThemeIcon size={24} radius="sm" variant="light" color="gray">
                      <IconRobot size={14} />
                    </ThemeIcon>
                    <Text fw={500}>Otomasyonlar</Text>
                    <Badge size="xs" variant="light">{activeAutomations} aktif</Badge>
                  </Group>
                  <Button variant="subtle" size="xs" onClick={openAutomation}>Yönet</Button>
                </Group>
                
                <Stack gap="xs">
                  {automationTasks.filter(t => t.enabled).slice(0, 4).map((task) => (
                    <Group key={task.id} justify="space-between" p="xs" style={{ borderRadius: 6, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                      <Group gap="xs">
                        <Box style={{ opacity: 0.6 }}>{task.icon}</Box>
                        <Box>
                          <Text size="xs" fw={500}>{task.name}</Text>
                          <Text size="xs" style={subtleText}>{task.schedule}</Text>
                        </Box>
                      </Group>
                      <Switch size="xs" checked={task.enabled} onChange={() => toggleAutomation(task.id)} />
                    </Group>
                  ))}
                </Stack>
              </Paper>

              {/* Son Aktiviteler */}
              <Paper p="lg" radius="lg" style={cardStyle}>
                <Group gap="xs" mb="md">
                  <ThemeIcon size={24} radius="sm" variant="light" color="gray">
                    <IconActivity size={14} />
                  </ThemeIcon>
                  <Text fw={500}>Son Aktiviteler</Text>
                </Group>
                
                <Timeline active={-1} bulletSize={20} lineWidth={1}>
                  {agentLogs.slice(0, 4).map((log) => (
                    <Timeline.Item
                      key={log.id}
                      bullet={
                        log.status === 'success' ? <IconCheck size={10} /> :
                        log.status === 'error' ? <IconX size={10} /> :
                        <IconLoader size={10} />
                      }
                      color={log.status === 'success' ? 'green' : log.status === 'error' ? 'red' : 'blue'}
                    >
                      <Text size="xs" fw={500}>{log.taskName}</Text>
                      <Text size="xs" style={subtleText} lineClamp={1}>{log.message}</Text>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Paper>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>

      {/* ===== MODALS ===== */}

      {/* Hesap Ekleme Modal */}
      <Modal 
        opened={addAccountModal} 
        onClose={closeAddAccount} 
        title={<Text fw={600}>Hesap Ekle</Text>}
        size="sm"
        centered
      >
        <Stack gap="md">
          <TextInput 
            label="Kullanıcı Adı" 
            placeholder="instagram_kullanici_adi" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            leftSection={<IconAt size={14} />}
          />
          <TextInput 
            label="Şifre" 
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
          <Button 
            fullWidth 
            leftSection={loginMutation.isPending ? <Loader size={14} color="white" /> : <IconPlug size={16} />}
            onClick={() => loginMutation.mutate({ username, password })}
            disabled={loginMutation.isPending || !username || !password}
          >
            {loginMutation.isPending ? 'Bağlanıyor...' : 'Bağlan'}
          </Button>
          <Text size="xs" style={subtleText} ta="center">
            Bilgileriniz güvenli şekilde saklanır.
          </Text>
        </Stack>
      </Modal>

      {/* 2FA Modal */}
      <Modal 
        opened={twoFactorModal} 
        onClose={closeTwoFactor} 
        title={<Text fw={600}>İki Faktörlü Doğrulama</Text>}
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm" style={subtleText}>Telefonunuza gelen 6 haneli kodu girin.</Text>
          <TextInput 
            placeholder="123456" 
            value={verificationCode} 
            onChange={(e) => setVerificationCode(e.target.value)} 
            maxLength={6}
            styles={{ input: { textAlign: 'center', letterSpacing: 8, fontSize: 20 } }}
          />
          <Button 
            fullWidth 
            onClick={() => loginMutation.mutate({ username, password, code: verificationCode })}
            loading={loginMutation.isPending}
          >
            Doğrula
          </Button>
        </Stack>
      </Modal>

      {/* Yeni Gönderi Modal */}
      <Modal 
        opened={newPostModal} 
        onClose={closeNewPost} 
        title={<Text fw={600}>Yeni Gönderi</Text>}
        size="lg"
        centered
      >
        <Stack gap="md">
          <FileInput 
            label="Görsel" 
            placeholder="Bir görsel seçin" 
            accept="image/*" 
            value={selectedFile} 
            onChange={setSelectedFile} 
            leftSection={<IconUpload size={14} />}
          />
          
          {selectedFile && (
            <Box style={{ borderRadius: 12, overflow: 'hidden', maxHeight: 250 }}>
              <img src={URL.createObjectURL(selectedFile)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>
          )}
          
          <Textarea 
            label="Açıklama" 
            placeholder="Gönderiniz için bir açıklama yazın..." 
            value={caption} 
            onChange={(e) => setCaption(e.target.value)} 
            minRows={3}
            rightSection={
              <Tooltip label="AI ile oluştur">
                <ActionIcon variant="subtle" onClick={handleGenerateCaption} loading={isGeneratingCaption} disabled={!selectedFile}>
                  <IconSparkles size={14} />
                </ActionIcon>
              </Tooltip>
            }
          />
          
          <Group gap="xs">
            <Button variant="light" size="xs" leftSection={<IconHash size={12} />} onClick={handleGenerateHashtags} loading={isGeneratingHashtags} disabled={!caption}>
              Hashtag Öner
            </Button>
          </Group>
          
          {suggestedHashtags.length > 0 && (
            <Group gap={4}>
              {suggestedHashtags.slice(0, 8).map((tag) => (
                <Badge key={tag} size="sm" variant="light" style={{ cursor: 'pointer' }} onClick={() => addHashtagToCaption(tag)}>
                  #{tag}
                </Badge>
              ))}
            </Group>
          )}
          
          <Divider />
          
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeNewPost}>İptal</Button>
            <Button 
              leftSection={uploadMutation.isPending ? <Loader size={14} color="white" /> : <IconSend size={14} />}
              onClick={() => selectedFile && uploadMutation.mutate({ file: selectedFile, caption })}
              loading={uploadMutation.isPending}
              disabled={!selectedFile}
            >
              Paylaş
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Post Detay Modal */}
      <Modal 
        opened={postDetailModal} 
        onClose={closePostDetail} 
        size="lg"
        padding={0}
        radius="lg"
        withCloseButton={false}
      >
        {selectedPost && (
          <Grid gutter={0}>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Image 
                src={selectedPost.thumbnail || 'https://placehold.co/600x600/1a1a1a/333?text=📷'} 
                style={{ width: '100%', height: '100%', minHeight: 350, objectFit: 'cover' }} 
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Stack gap={0} h="100%">
                <Box p="md" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Avatar src={profile?.profile_pic} radius="xl" size="sm">{selectedAccount?.username?.[0]?.toUpperCase()}</Avatar>
                      <Text size="sm" fw={500}>@{selectedAccount?.username}</Text>
                    </Group>
                    <ActionIcon variant="subtle" onClick={closePostDetail}><IconX size={16} /></ActionIcon>
                  </Group>
                </Box>
                <ScrollArea style={{ flex: 1 }} p="md">
                  <Text size="sm">{selectedPost.caption || 'Açıklama yok'}</Text>
                  <Text size="xs" style={subtleText} mt="md">{formatTimestamp(selectedPost.timestamp)}</Text>
                </ScrollArea>
                <Box p="md" style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                  <Group justify="space-between" mb="sm">
                    <Group gap="md">
                      <Group gap={4}><IconHeart size={18} /><Text size="sm" fw={500}>{formatNumber(selectedPost.likes)}</Text></Group>
                      <Group gap={4}><IconMessageCircle size={18} /><Text size="sm" fw={500}>{formatNumber(selectedPost.comments)}</Text></Group>
                    </Group>
                    <Group gap="xs">
                      <ActionIcon variant="subtle"><IconBookmark size={16} /></ActionIcon>
                      <ActionIcon variant="subtle"><IconShare size={16} /></ActionIcon>
                    </Group>
                  </Group>
                  <Button variant="light" fullWidth size="sm" leftSection={<IconExternalLink size={14} />} component="a" href={`https://instagram.com/p/${selectedPost.code}`} target="_blank">
                    Instagram'da Aç
                  </Button>
                </Box>
              </Stack>
            </Grid.Col>
          </Grid>
        )}
      </Modal>

      {/* DM Modal */}
      <Modal 
        opened={dmModal} 
        onClose={closeDM} 
        title={selectedDM ? <Group gap="sm"><Avatar radius="xl" size="sm">{selectedDM.users[0]?.[0]?.toUpperCase()}</Avatar><Text fw={500}>@{selectedDM.users[0]}</Text></Group> : 'Mesaj'}
        size="md"
      >
        {selectedDM && (
          <Stack gap="md">
            <ScrollArea h={300}>
              <Stack gap="sm">
                {dmMessages.length === 0 ? (
                  <Text ta="center" style={subtleText}>Mesajlar yükleniyor...</Text>
                ) : dmMessages.map((msg) => (
                  <Group key={msg.id} justify={msg.is_me ? 'flex-end' : 'flex-start'}>
                    <Paper p="sm" radius="md" maw="80%" style={{ background: msg.is_me ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') }}>
                      <Text size="sm">{msg.text}</Text>
                      <Text size="xs" style={subtleText} ta="right" mt={4}>{formatTimestamp(msg.timestamp)}</Text>
                    </Paper>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
            
            <ScrollArea type="never">
              <Group gap="xs" wrap="nowrap">
                {quickReplies.map((qr, i) => (
                  <Button key={i} size="xs" variant="light" onClick={() => setNewMessage(qr.text)} style={{ flexShrink: 0 }}>
                    {qr.label}
                  </Button>
                ))}
              </Group>
            </ScrollArea>
            
            <Group>
              <TextInput 
                placeholder="Mesaj yaz..." 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendDM()}
                style={{ flex: 1 }}
              />
              <ActionIcon size="lg" variant="filled" onClick={handleSendDM} loading={isSendingDM} disabled={!newMessage.trim()}>
                <IconSend size={16} />
              </ActionIcon>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* AI Araçları Modal */}
      <Modal 
        opened={aiToolsModal} 
        onClose={closeAITools} 
        title={<Group gap="xs"><IconSparkles size={18} /><Text fw={600}>AI Araçları</Text></Group>}
        size="xl"
      >
        <Tabs defaultValue="caption">
          <Tabs.List mb="md">
            <Tabs.Tab value="caption" leftSection={<IconCamera size={14} />}>Caption</Tabs.Tab>
            <Tabs.Tab value="hashtag" leftSection={<IconHash size={14} />}>Hashtag</Tabs.Tab>
            <Tabs.Tab value="image" leftSection={<IconPhoto size={14} />}>Görsel Üret</Tabs.Tab>
            <Tabs.Tab value="menu" leftSection={<IconTemplate size={14} />}>Menü Kartı</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="caption">
            <Stack gap="md">
              {/* Açıklama */}
              <Paper p="sm" radius="md" style={{ 
                background: isDark 
                  ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(244, 114, 182, 0.05) 100%)' 
                  : 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(244, 114, 182, 0.04) 100%)',
                border: `1px solid ${isDark ? 'rgba(236, 72, 153, 0.2)' : 'rgba(236, 72, 153, 0.15)'}`,
              }}>
                <Group gap="xs" align="flex-start">
                  <ThemeIcon size={28} radius="md" variant="light" color="pink">
                    <IconCamera size={14} />
                  </ThemeIcon>
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>Görsel → Caption</Text>
                    <Text size="xs" style={subtleText}>
                      Görseli yükleyin, AI içeriğe uygun Türkçe açıklama oluştursun. Yemek fotoğraflarında harika çalışır!
                    </Text>
                  </Box>
                </Group>
              </Paper>

              <FileInput 
                label="Görsel Seç" 
                placeholder="Bir görsel seçin veya sürükleyip bırakın" 
                accept="image/*" 
                value={selectedFile} 
                onChange={setSelectedFile}
                leftSection={<IconPhoto size={14} />}
                styles={{
                  input: {
                    background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                  }
                }}
              />
              {selectedFile && (
                <Box style={{ borderRadius: 12, overflow: 'hidden', height: 180, position: 'relative' }}>
                  <img src={URL.createObjectURL(selectedFile)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <Box style={{ 
                    position: 'absolute', 
                    bottom: 0, 
                    left: 0, 
                    right: 0, 
                    padding: '8px 12px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                  }}>
                    <Text size="xs" c="white" truncate>{selectedFile.name}</Text>
                  </Box>
                </Box>
              )}
              <Button 
                variant="gradient"
                gradient={{ from: 'pink', to: 'grape', deg: 135 }}
                leftSection={isGeneratingCaption ? <Loader size={14} color="white" /> : <IconWand size={16} />}
                onClick={handleGenerateCaption}
                loading={isGeneratingCaption}
                disabled={!selectedFile}
                fullWidth
              >
                Caption Üret
              </Button>
              {caption && (
                <Paper p="md" radius="md" style={{ 
                  background: isDark ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.03)',
                  border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)'}`,
                }}>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <IconCheck size={14} style={{ color: '#22c55e' }} />
                      <Text size="sm" fw={600}>Oluşturulan Caption</Text>
                    </Group>
                    <Tooltip label="Kopyala">
                      <ActionIcon 
                        variant="subtle" 
                        size="sm" 
                        onClick={() => {
                          navigator.clipboard.writeText(caption);
                          notifications.show({ message: 'Caption kopyalandı', color: 'green' });
                        }}
                      >
                        <IconCopy size={12} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                  <Text size="sm" style={{ lineHeight: 1.6 }}>{caption}</Text>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="hashtag">
            <Stack gap="md">
              {/* Açıklama */}
              <Paper p="sm" radius="md" style={{ 
                background: isDark 
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)' 
                  : 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%)',
                border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)'}`,
              }}>
                <Group gap="xs" align="flex-start">
                  <ThemeIcon size={28} radius="md" variant="light" color="indigo">
                    <IconHash size={14} />
                  </ThemeIcon>
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>Akıllı Hashtag Önerici</Text>
                    <Text size="xs" style={subtleText}>
                      İçeriğinize uygun, trend ve lokasyon bazlı hashtagler önerir. Tıklayarak caption'a ekleyebilirsiniz.
                    </Text>
                  </Box>
                </Group>
              </Paper>

              {/* Hızlı Başlangıç Önerileri */}
              <Box>
                <Text size="xs" fw={500} mb={6} style={subtleText}>💡 Hızlı başlangıç:</Text>
                <ScrollArea type="never">
                  <Group gap={6} wrap="nowrap">
                    {['Bugünkü öğle menümüz hazır! 🍽️', 'Taze malzeme, lezzetli yemek', 'Haftalık menü planı açıklandı', 'Kurumsal catering hizmeti'].map((s) => (
                      <Badge 
                        key={s} 
                        size="sm" 
                        variant="outline"
                        color="gray"
                        style={{ cursor: 'pointer', flexShrink: 0 }} 
                        onClick={() => setCaption(s)}
                      >
                        {s}
                      </Badge>
                    ))}
                  </Group>
                </ScrollArea>
              </Box>

              {/* Caption Input */}
              <Textarea 
                label={
                  <Group justify="space-between" w="100%">
                    <Text size="sm" fw={500}>Caption</Text>
                    <Text size="xs" style={subtleText}>{caption.length} karakter</Text>
                  </Group>
                }
                placeholder="Hashtag önerisi için caption veya konu yazın..." 
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                minRows={3}
                styles={{
                  input: {
                    background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                    '&:focus': { borderColor: 'var(--mantine-color-indigo-5)' }
                  }
                }}
              />
              
              {/* Hashtag Üret Butonu */}
              <Button 
                variant="gradient"
                gradient={{ from: 'indigo', to: 'violet', deg: 135 }}
                leftSection={isGeneratingHashtags ? <Loader size={14} color="white" /> : <IconHash size={16} />}
                onClick={handleGenerateHashtags}
                loading={isGeneratingHashtags}
                disabled={!caption}
                fullWidth
              >
                Hashtag Öner
              </Button>

              {/* Önerilen Hashtagler */}
              {suggestedHashtags.length > 0 && (
                <Paper p="md" radius="md" style={{ 
                  background: isDark ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.03)',
                  border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)'}`,
                }}>
                  <Group justify="space-between" mb="sm">
                    <Group gap="xs">
                      <IconCheck size={14} style={{ color: '#22c55e' }} />
                      <Text size="sm" fw={600}>{suggestedHashtags.length} Hashtag Önerildi</Text>
                    </Group>
                    <Tooltip label="Tümünü kopyala">
                      <ActionIcon 
                        variant="subtle" 
                        size="sm" 
                        onClick={() => {
                          navigator.clipboard.writeText(suggestedHashtags.map(t => `#${t}`).join(' '));
                          notifications.show({ message: 'Hashtagler kopyalandı', color: 'green' });
                        }}
                      >
                        <IconCopy size={12} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                  <Text size="xs" style={subtleText} mb="sm">🎯 Tıklayarak caption'a ekle</Text>
                  <Group gap={6}>
                    {suggestedHashtags.map((tag) => (
                      <Badge 
                        key={tag} 
                        size="sm" 
                        variant="light" 
                        color="teal"
                        style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
                        styles={{ root: { '&:hover': { transform: 'scale(1.05)' } } }}
                        onClick={() => {
                          addHashtagToCaption(tag);
                          notifications.show({ message: `#${tag} eklendi`, color: 'green', autoClose: 1500 });
                        }}
                      >
                        #{tag}
                      </Badge>
                    ))}
                  </Group>
                </Paper>
              )}

              {/* İpucu */}
              <Text size="xs" style={subtleText} ta="center">
                💡 En iyi sonuç için yemek türü, lokasyon ve hedef kitle bilgisi ekleyin
              </Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="image">
            <Stack gap="md">
              {/* Açıklama */}
              <Paper p="sm" radius="md" style={{ 
                background: isDark 
                  ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(34, 211, 238, 0.05) 100%)' 
                  : 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(34, 211, 238, 0.04) 100%)',
                border: `1px solid ${isDark ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.15)'}`,
              }}>
                <Group gap="xs" align="flex-start">
                  <ThemeIcon size={28} radius="md" variant="light" color="cyan">
                    <IconPhoto size={14} />
                  </ThemeIcon>
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>AI Görsel Üretici</Text>
                    <Text size="xs" style={subtleText}>
                      Türkçe yaz, AI İngilizce prompt'a çevirip profesyonel görsel üretsin. Flux Schnell ile ~3 saniyede hazır!
                    </Text>
                  </Box>
                </Group>
              </Paper>

              {/* Hızlı Öneriler */}
              <Box>
                <Text size="xs" fw={500} mb={6} style={subtleText}>🍽️ Popüler yemek görselleri:</Text>
                <ScrollArea type="never">
                  <Group gap={6} wrap="nowrap">
                    {['Izgara tavuk, pilav', 'Taze salata, stüdyo', 'Mercimek çorbası', 'Et sote, sebze', 'Kahvaltı tabağı'].map((s) => (
                      <Badge 
                        key={s} 
                        size="sm" 
                        variant="outline"
                        color="cyan"
                        style={{ cursor: 'pointer', flexShrink: 0 }} 
                        onClick={() => setImagePrompt(s)}
                      >
                        {s}
                      </Badge>
                    ))}
                  </Group>
                </ScrollArea>
              </Box>

              <Textarea 
                label="Görsel Açıklaması"
                placeholder="Örn: Profesyonel fotoğraf, pilav üstü et sote, stüdyo ışığında, beyaz tabakta..." 
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                minRows={2}
                styles={{
                  input: {
                    background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                  }
                }}
              />

              {generatedPrompt && (
                <Paper p="sm" radius="md" style={{ 
                  background: isDark ? 'rgba(139, 92, 246, 0.05)' : 'rgba(139, 92, 246, 0.03)',
                  border: `1px solid ${isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.15)'}`,
                }}>
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <IconCheck size={12} style={{ color: '#8b5cf6' }} />
                      <Text size="xs" fw={500}>İngilizce Prompt</Text>
                    </Group>
                    <Tooltip label="Kopyala">
                      <ActionIcon variant="subtle" size="xs" onClick={() => {
                        navigator.clipboard.writeText(generatedPrompt.prompt);
                        notifications.show({ message: 'Prompt kopyalandı', color: 'violet' });
                      }}>
                        <IconCopy size={10} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                  <Text size="xs" style={subtleText} lineClamp={2}>{generatedPrompt.prompt}</Text>
                </Paper>
              )}

              {generatedImage && (
                <Paper p="xs" radius="md" style={{ 
                  background: isDark ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.03)',
                  border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)'}`,
                }}>
                  <Box style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                    <img src={generatedImage} alt="AI Generated" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                  </Box>
                  <Group justify="center">
                    <Button 
                      size="xs" 
                      variant="light" 
                      color="green"
                      leftSection={<IconDownload size={12} />} 
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = generatedImage;
                        link.download = `ai-gorsel-${Date.now()}.webp`;
                        link.click();
                      }}
                    >
                      İndir (1024x1024)
                    </Button>
                  </Group>
                </Paper>
              )}

              <Group gap="xs">
                <Button 
                  variant="light"
                  color="violet"
                  leftSection={isGeneratingPrompt ? <Loader size={14} /> : <IconWand size={14} />}
                  onClick={handleGenerateImagePrompt}
                  loading={isGeneratingPrompt}
                  disabled={!imagePrompt.trim()}
                  style={{ flex: 1 }}
                >
                  1. Prompt Oluştur
                </Button>
                <Button 
                  variant="gradient"
                  gradient={{ from: 'cyan', to: 'teal', deg: 135 }}
                  leftSection={isGeneratingImage ? <Loader size={14} color="white" /> : <IconSparkles size={14} />}
                  onClick={handleGenerateImage}
                  loading={isGeneratingImage}
                  disabled={!generatedPrompt}
                  style={{ flex: 1 }}
                >
                  2. Görsel Üret
                </Button>
              </Group>

              <Text size="xs" style={subtleText} ta="center">
                ⚡ Flux Schnell • ~3 saniye • 1024x1024px
              </Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="menu">
            <Stack gap="md">
              {/* Açıklama */}
              <Paper p="sm" radius="md" style={{ 
                background: isDark 
                  ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)' 
                  : 'linear-gradient(135deg, rgba(251, 146, 60, 0.08) 0%, rgba(249, 115, 22, 0.04) 100%)',
                border: `1px solid ${isDark ? 'rgba(251, 146, 60, 0.2)' : 'rgba(251, 146, 60, 0.15)'}`,
              }}>
                <Group gap="xs" align="flex-start">
                  <ThemeIcon size={28} radius="md" variant="light" color="orange">
                    <IconTemplate size={14} />
                  </ThemeIcon>
                  <Box style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>Menü Kartı Oluşturucu</Text>
                    <Text size="xs" style={subtleText}>
                      Hazır şablonlarla profesyonel menü görselleri oluşturun. Instagram post veya story için ideal!
                    </Text>
                  </Box>
                </Group>
              </Paper>

              <Select 
                label="Şablon Seç"
                description="Menü kartınız için görsel stil seçin"
                value={menuCardTemplate}
                onChange={(v) => setMenuCardTemplate(v || 'modern')}
                data={[
                  { value: 'modern', label: '🎨 Modern - Gradient arka plan' },
                  { value: 'classic', label: '📜 Klasik - Zarif ve minimal' },
                  { value: 'minimal', label: '⚪ Minimal - Temiz ve sade' },
                  { value: 'story', label: '📱 Story - Dikey format (9:16)' },
                ]}
                styles={{
                  input: {
                    background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                  }
                }}
              />

              <Paper p="sm" radius="md" style={{ 
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
              }}>
                <Text size="xs" fw={500} mb={4}>📋 Örnek Menü İçeriği:</Text>
                <Text size="xs" style={subtleText}>{menuCardItems.map(i => i.name).join(' • ')}</Text>
              </Paper>

              {menuCardHtml && (
                <Paper p="md" radius="md" style={{ 
                  background: isDark ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.03)',
                  border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)'}`,
                }}>
                  <Group gap="xs">
                    <IconCheck size={16} style={{ color: '#22c55e' }} />
                    <Text size="sm" fw={500} c="green">HTML şablonu hazır!</Text>
                  </Group>
                </Paper>
              )}

              <Button 
                variant="gradient"
                gradient={{ from: 'orange', to: 'red', deg: 135 }}
                leftSection={isGeneratingMenuCard ? <Loader size={14} color="white" /> : <IconPalette size={16} />}
                onClick={handleGenerateMenuCard}
                loading={isGeneratingMenuCard}
                fullWidth
              >
                Menü Kartı Oluştur
              </Button>

              <Text size="xs" style={subtleText} ta="center">
                💡 Oluşturulan kart indirilebilir PNG/HTML formatında
              </Text>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Modal>

      {/* Otomasyonlar Modal */}
      <Modal 
        opened={automationModal} 
        onClose={closeAutomation} 
        title={<Group gap="xs"><IconRobot size={18} /><Text fw={600}>Otomasyonlar</Text></Group>}
        size="lg"
      >
        <Text size="sm" style={subtleText} mb="md">
          Seçili hesap için otomasyonları yönetin: <Text span fw={500}>@{selectedAccount?.username}</Text>
        </Text>
        
        <Stack gap="xs">
          {automationTasks.map((task) => (
            <Paper key={task.id} p="md" radius="md" style={{ ...cardStyle, border: task.enabled ? `1px solid ${isDark ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.2)'}` : undefined }}>
              <Group justify="space-between">
                <Group gap="md">
                  <Box style={{ opacity: task.enabled ? 1 : 0.4 }}>{task.icon}</Box>
                  <Box>
                    <Text size="sm" fw={500}>{task.name}</Text>
                    <Text size="xs" style={subtleText}>{task.description}</Text>
                    <Text size="xs" style={subtleText}>{task.schedule}</Text>
                  </Box>
                </Group>
                <Group gap="xs">
                  <Tooltip label="Şimdi Çalıştır">
                    <ActionIcon variant="light" size="sm" onClick={() => runAutomationNow(task.id)} disabled={!task.enabled}>
                      <IconPlayerPlay size={12} />
                    </ActionIcon>
                  </Tooltip>
                  <Switch checked={task.enabled} onChange={() => toggleAutomation(task.id)} />
                </Group>
              </Group>
              {task.stats && (
                <Group gap="md" mt="xs">
                  <Text size="xs" style={subtleText}>{task.stats.totalRuns} çalışma</Text>
                  <Text size="xs" style={subtleText}>%{task.stats.successRate} başarı</Text>
                </Group>
              )}
            </Paper>
          ))}
        </Stack>
      </Modal>
    </Box>
  );
}
