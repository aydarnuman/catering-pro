/**
 * Swagger/OpenAPI Configuration
 * Catering Pro API Documentation
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Catering Pro API',
      version: '1.0.0',
      description: `
## Catering Pro - İş Yönetim Sistemi API

Hazır yemek sektörü için geliştirilmiş entegre iş yönetim sistemi.

### Modüller
- **İhale Takip** - Kamu ihaleleri scraping ve analiz
- **Muhasebe** - Cari, fatura, stok, kasa-banka
- **Personel/Bordro** - HR ve maaş yönetimi
- **Planlama** - Menü ve üretim planlama
- **AI Asistan** - Döküman analizi ve sohbet

### Kimlik Doğrulama
JWT Bearer token kullanılır. Login endpoint'inden token alınır.
      `,
      contact: {
        name: 'Catering Pro Team',
        email: 'info@cateringpro.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development Server'
      },
      {
        url: 'https://api.cateringpro.com',
        description: 'Production Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token - Login endpoint\'inden alınır'
        }
      },
      schemas: {
        // Genel Response
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            count: { type: 'integer', example: 10 }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Hata mesajı' }
          }
        },
        // Cari
        Cari: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            tip: { type: 'string', enum: ['musteri', 'tedarikci', 'her_ikisi'], example: 'musteri' },
            unvan: { type: 'string', example: 'ABC Şirketi' },
            yetkili: { type: 'string', example: 'Ahmet Yılmaz' },
            vergi_no: { type: 'string', example: '1234567890' },
            vergi_dairesi: { type: 'string', example: 'Ankara' },
            telefon: { type: 'string', example: '0312 123 45 67' },
            email: { type: 'string', example: 'info@abc.com' },
            adres: { type: 'string' },
            il: { type: 'string', example: 'Ankara' },
            ilce: { type: 'string', example: 'Çankaya' },
            borc: { type: 'number', example: 5000.00 },
            alacak: { type: 'number', example: 3000.00 },
            bakiye: { type: 'number', example: -2000.00 },
            aktif: { type: 'boolean', example: true },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        // Stok Kartı
        StokKarti: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            kod: { type: 'string', example: 'STK001' },
            ad: { type: 'string', example: 'Pirinç' },
            kategori: { type: 'string', example: 'Bakliyat' },
            birim: { type: 'string', example: 'kg' },
            miktar: { type: 'number', example: 150.5 },
            kritik_stok: { type: 'number', example: 20 },
            son_alis_fiyat: { type: 'number', example: 45.00 },
            aktif: { type: 'boolean', example: true }
          }
        },
        // Personel
        Personel: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            sicil_no: { type: 'string', example: 'P001' },
            tc_kimlik: { type: 'string', example: '12345678901' },
            ad: { type: 'string', example: 'Mehmet' },
            soyad: { type: 'string', example: 'Demir' },
            telefon: { type: 'string', example: '0532 123 45 67' },
            departman: { type: 'string', example: 'Mutfak' },
            pozisyon: { type: 'string', example: 'Aşçı' },
            maas: { type: 'number', example: 25000.00 },
            ise_giris_tarihi: { type: 'string', format: 'date' },
            durum: { type: 'string', enum: ['aktif', 'izinli', 'pasif'], example: 'aktif' }
          }
        },
        // İhale
        Tender: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            external_id: { type: 'string', example: 'IH2024001' },
            title: { type: 'string', example: 'Hazır Yemek Hizmeti Alımı' },
            organization_name: { type: 'string', example: 'Ankara Belediyesi' },
            city: { type: 'string', example: 'Ankara' },
            tender_date: { type: 'string', format: 'date-time' },
            estimated_cost: { type: 'number', example: 1500000 },
            status: { type: 'string', enum: ['active', 'expired', 'won', 'lost'], example: 'active' },
            url: { type: 'string', example: 'https://ihalebul.com/...' }
          }
        },
        // Fatura
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            fatura_no: { type: 'string', example: 'FTR2024001' },
            tip: { type: 'string', enum: ['alis', 'satis'], example: 'satis' },
            cari_id: { type: 'integer', example: 1 },
            tarih: { type: 'string', format: 'date' },
            vade_tarihi: { type: 'string', format: 'date' },
            toplam_tutar: { type: 'number', example: 15000.00 },
            kdv_tutar: { type: 'number', example: 2700.00 },
            genel_toplam: { type: 'number', example: 17700.00 },
            odendi: { type: 'boolean', example: false }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Kimlik doğrulama işlemleri' },
      { name: 'Cariler', description: 'Müşteri ve tedarikçi yönetimi' },
      { name: 'Stok', description: 'Stok ve depo yönetimi' },
      { name: 'Personel', description: 'Personel ve HR işlemleri' },
      { name: 'Bordro', description: 'Bordro hesaplama ve yönetimi' },
      { name: 'Faturalar', description: 'Fatura yönetimi' },
      { name: 'Kasa-Banka', description: 'Nakit akış yönetimi' },
      { name: 'Tenders', description: 'İhale takip ve yönetimi' },
      { name: 'Documents', description: 'Döküman işleme ve analiz' },
      { name: 'AI', description: 'AI asistan ve analiz' },
      { name: 'Planlama', description: 'Menü ve üretim planlama' },
      { name: 'Projeler', description: 'Proje yönetimi' }
    ]
  },
  apis: ['./src/routes/*.js', './src/server.js']
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
