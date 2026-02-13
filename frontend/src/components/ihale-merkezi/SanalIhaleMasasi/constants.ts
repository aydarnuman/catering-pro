import type { AgentPersona, AgentTool, AttachmentTypeConfig } from './types';

export const AGENTS: AgentPersona[] = [
  {
    id: 'mevzuat',
    name: 'Mevzuat & Sozlesme',
    subtitle: 'Kanun & Sozlesme Analizi',
    color: 'indigo',
    accentHex: '#6366f1',
    iconName: 'scale',
    orbitPosition: { top: '8%', left: '6%' },
    side: 'left',
    assembleDelay: 0,
    assembleOffset: { x: -120, y: -80 },
    mobileOrder: 0,
  },
  {
    id: 'maliyet',
    name: 'Maliyet & Butce',
    subtitle: 'Finansal Risk Degerlendirmesi',
    color: 'green',
    accentHex: '#10b981',
    iconName: 'calculator',
    orbitPosition: { top: '8%', right: '6%' },
    side: 'right',
    assembleDelay: 0.1,
    assembleOffset: { x: 120, y: -80 },
    mobileOrder: 1,
  },
  {
    id: 'teknik',
    name: 'Teknik Yeterlilik',
    subtitle: 'Teknik Sartname Degerlendirmesi',
    color: 'yellow',
    accentHex: '#f59e0b',
    iconName: 'hardhat',
    orbitPosition: { bottom: '12%', right: '6%' },
    side: 'right',
    assembleDelay: 0.2,
    assembleOffset: { x: 120, y: 80 },
    mobileOrder: 2,
  },
  {
    id: 'rekabet',
    name: 'Rekabet Istihbarati',
    subtitle: 'Piyasa & Rakip Analizi',
    color: 'pink',
    accentHex: '#f43f5e',
    iconName: 'radar',
    orbitPosition: { bottom: '12%', left: '6%' },
    side: 'left',
    assembleDelay: 0.3,
    assembleOffset: { x: -120, y: 80 },
    mobileOrder: 3,
  },
];

// ─── Agent Tool Registry ────────────────────────────────────

export const AGENT_TOOLS: AgentTool[] = [
  // ─── Mevzuat (Legal) ───
  {
    id: 'redline',
    agentId: 'mevzuat',
    label: 'Maddeyi Duzenle',
    icon: 'pencil',
    description: 'Riskli maddeyi teklif veren lehine yeniden yazar',
    requiresSelection: true,
  },
  {
    id: 'emsal',
    agentId: 'mevzuat',
    label: 'KIK/Mahkeme Karari Ara',
    icon: 'gavel',
    description: 'Bu konuyla ilgili emsal kararlari tarar',
  },
  {
    id: 'zeyilname',
    agentId: 'mevzuat',
    label: 'Zeyilname Olustur',
    icon: 'file-text',
    description: 'Idareye resmi itiraz mektubu taslagi hazirlar',
    urgencyPriority: 1,
  },
  // ─── Maliyet (Finance) ───
  {
    id: 'maliyet_hesapla',
    agentId: 'maliyet',
    label: 'Maliyet Hesapla',
    icon: 'calculator',
    description: 'Menu bazli tahmini maliyet analizi yapar',
  },
  {
    id: 'piyasa_karsilastir',
    agentId: 'maliyet',
    label: 'Piyasa Karsilastir',
    icon: 'chart-bar',
    description: 'Birim fiyatlari guncel piyasa ile karsilastirir',
  },
  {
    id: 'teminat_hesapla',
    agentId: 'maliyet',
    label: 'Teminat Hesapla',
    icon: 'shield-check',
    description: 'Gecici ve kesin teminat tutarlarini hesaplar',
    urgencyPriority: 1,
  },
  // ─── Teknik (Technical) ───
  {
    id: 'personel_karsilastir',
    agentId: 'teknik',
    label: 'Personel Analizi',
    icon: 'users',
    description: 'Sartnamedeki personel gereksinimlerini analiz eder',
  },
  {
    id: 'menu_uygunluk',
    agentId: 'teknik',
    label: 'Menu Uygunluk',
    icon: 'chef-hat',
    description: 'Ogun gereksinimlerini mevcut menu kapasitesiyle esler',
  },
  {
    id: 'kapasite_kontrol',
    agentId: 'teknik',
    label: 'Kapasite Kontrolu',
    icon: 'gauge',
    description: 'Uretim kapasitesi yeterlilik analizi yapar',
  },
  // ─── Rekabet (Competition) ───
  {
    id: 'benzer_ihale',
    agentId: 'rekabet',
    label: 'Benzer Ihale Ara',
    icon: 'search',
    description: 'Gecmis benzer ihaleleri bulur ve analiz eder',
  },
  {
    id: 'teklif_stratejisi',
    agentId: 'rekabet',
    label: 'Teklif Stratejisi',
    icon: 'target',
    description: 'Optimal teklif stratejisi ve senaryolar onerir',
    urgencyPriority: 1,
  },
];

// ─── Orbit Attachment Type Registry ─────────────────────

export const ATTACHMENT_TYPES: AttachmentTypeConfig[] = [
  {
    type: 'note',
    label: 'Not',
    icon: 'note',
    color: 'yellow',
    description: 'Serbest metin notlari',
    userCreatable: true,
  },
  {
    type: 'document',
    label: 'Dokuman',
    icon: 'file-text',
    color: 'blue',
    description: 'Yuklu dosya ve dokumanlar',
    userCreatable: true,
  },
  {
    type: 'petition',
    label: 'Dilekce / Zeyilname',
    icon: 'file-certificate',
    color: 'violet',
    description: 'Resmi itiraz ve zeyilname taslaklari',
    userCreatable: false,
  },
  {
    type: 'ai_report',
    label: 'AI Raporu',
    icon: 'brain',
    color: 'cyan',
    description: 'Agent tarafindan uretilen analizler',
    userCreatable: false,
  },
  {
    type: 'link',
    label: 'Baglanti',
    icon: 'link',
    color: 'teal',
    description: 'Harici URL baglantilari',
    userCreatable: true,
  },
  {
    type: 'contact',
    label: 'Kisi / Iletisim',
    icon: 'user',
    color: 'pink',
    description: 'Ilgili kisi ve iletisim bilgileri',
    userCreatable: true,
  },
  {
    type: 'calculation',
    label: 'Hesaplama',
    icon: 'math-function',
    color: 'orange',
    description: 'Maliyet ve fiyat hesaplamalari',
    userCreatable: true,
  },
];

export const ATTACHMENT_TYPE_MAP = Object.fromEntries(ATTACHMENT_TYPES.map((t) => [t.type, t])) as Record<
  string,
  AttachmentTypeConfig
>;

/** framer-motion transition presets */
export const SPRING_CONFIG = {
  stiff: { type: 'spring' as const, stiffness: 200, damping: 25 },
  gentle: { type: 'spring' as const, stiffness: 80, damping: 18 },
  snappy: { type: 'spring' as const, stiffness: 300, damping: 30 },
};
