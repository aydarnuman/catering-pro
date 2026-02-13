/**
 * Mail Servisi
 * Resend API veya SMTP ile e-posta gönderimi ve şablon yönetimi
 */

import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { query } from '../database.js';
import logger, { logAPI, logError } from '../utils/logger.js';

// =====================================================
// MAIL PROVIDER (Resend veya SMTP)
// =====================================================

let resendClient = null;
let transporter = null;

/**
 * Resend client'ı başlat
 */
function initResend() {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * SMTP bağlantısını başlat (fallback)
 */
async function initTransporter() {
  if (transporter) return transporter;

  // Varsayılan ayarları dene, yoksa env'den al
  const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };

  if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
    return null;
  }

  transporter = nodemailer.createTransport(smtpConfig);

  // Bağlantıyı test et
  try {
    await transporter.verify();
  } catch (err) {
    logger.warn('[MailService] SMTP baglanti testi basarisiz', { error: err.message });
    transporter = null;
  }

  return transporter;
}

// =====================================================
// MAIL ŞABLONLARI
// =====================================================

const MAIL_TEMPLATES = {
  // Sözleşme bitiş hatırlatması
  SOZLESME_BITIS: {
    subject: '⚠️ Sözleşme Bitiş Hatırlatması - {{proje_ad}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">📋 Sözleşme Bitiş Hatırlatması</h2>
        </div>
        <div style="padding: 20px; background: #fff; border: 1px solid #e5e7eb; border-top: none;">
          <p>Merhaba,</p>
          <p><strong>{{proje_ad}}</strong> projesinin sözleşmesi <strong>{{gun}} gün</strong> içinde sona erecek.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Proje Kodu</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">{{proje_kod}}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Sözleşme No</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">{{sozlesme_no}}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Bitiş Tarihi</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">{{bitis_tarihi}}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Sözleşme Bedeli</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">₺{{sozlesme_bedeli}}</td>
            </tr>
          </table>
          
          <p style="color: #dc2626;">Lütfen sözleşme yenileme veya uzatma işlemlerini başlatın.</p>
          
          <a href="{{link}}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Projeyi Görüntüle
          </a>
        </div>
        <div style="padding: 15px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px;">
          Bu e-posta Catering Pro sistem tarafından otomatik gönderilmiştir.
        </div>
      </div>
    `,
  },

  // Teminat iade hatırlatması
  TEMINAT_IADE: {
    subject: '💰 Teminat İade Hatırlatması - {{proje_ad}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">💰 Teminat İade Hatırlatması</h2>
        </div>
        <div style="padding: 20px; background: #fff; border: 1px solid #e5e7eb; border-top: none;">
          <p>Merhaba,</p>
          <p><strong>{{proje_ad}}</strong> projesinin teminat iade tarihi yaklaşıyor.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Proje</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">{{proje_ad}}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Teminat Tutarı</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; color: #16a34a; font-weight: bold;">₺{{teminat_tutari}}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>İade Tarihi</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">{{iade_tarihi}}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Kalan Gün</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">{{gun}} gün</td>
            </tr>
          </table>
          
          <p>Teminat iade işlemleri için gerekli evrakları hazırlayın.</p>
        </div>
        <div style="padding: 15px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px;">
          Bu e-posta Catering Pro sistem tarafından otomatik gönderilmiştir.
        </div>
      </div>
    `,
  },

  // Sertifika yenileme hatırlatması
  SERTIFIKA_YENILEME: {
    subject: '📜 Sertifika Yenileme Hatırlatması - {{sertifika_adi}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">📜 Sertifika Yenileme Hatırlatması</h2>
        </div>
        <div style="padding: 20px; background: #fff; border: 1px solid #e5e7eb; border-top: none;">
          <p>Merhaba,</p>
          <p><strong>{{firma_unvan}}</strong> firmasının <strong>{{sertifika_adi}}</strong> sertifikası <strong>{{gun}} gün</strong> içinde sona erecek.</p>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <strong>⚠️ Dikkat:</strong> Sertifika geçerliliği ihale katılımları için kritik öneme sahiptir.
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Sertifika</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">{{sertifika_adi}}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Bitiş Tarihi</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">{{bitis_tarihi}}</td>
            </tr>
          </table>
          
          <p>Lütfen sertifika yenileme sürecini başlatın.</p>
        </div>
        <div style="padding: 15px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px;">
          Bu e-posta Catering Pro sistem tarafından otomatik gönderilmiştir.
        </div>
      </div>
    `,
  },

  // Hakediş kesim günü hatırlatması
  HAKEDIS_KESIM: {
    subject: '📊 Hakediş Kesim Günü - {{proje_ad}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">📊 Hakediş Kesim Günü Hatırlatması</h2>
        </div>
        <div style="padding: 20px; background: #fff; border: 1px solid #e5e7eb; border-top: none;">
          <p>Merhaba,</p>
          <p><strong>{{proje_ad}}</strong> projesi için hakediş kesim günü yaklaşıyor.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Proje</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">{{proje_ad}}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Kesim Günü</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">Her ayın {{hakedis_gun}}. günü</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Aylık Hakediş</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb; color: #2563eb; font-weight: bold;">₺{{aylik_hakedis}}</td>
            </tr>
          </table>
          
          <p>Hakediş evraklarını hazırlayıp teslim etmeyi unutmayın.</p>
        </div>
        <div style="padding: 15px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px;">
          Bu e-posta Catering Pro sistem tarafından otomatik gönderilmiştir.
        </div>
      </div>
    `,
  },

  // Fatura kesim günü hatırlatması
  FATURA_KESIM: {
    subject: '🧾 Fatura Kesim Günü - {{proje_ad}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #06b6d4, #0891b2); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">🧾 Fatura Kesim Günü Hatırlatması</h2>
        </div>
        <div style="padding: 20px; background: #fff; border: 1px solid #e5e7eb; border-top: none;">
          <p>Merhaba,</p>
          <p><strong>{{proje_ad}}</strong> projesi için fatura kesim günü yaklaşıyor.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Fatura Unvanı</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">{{fatura_unvani}}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Vergi No</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">{{fatura_vergi_no}}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>Kesim Günü</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">Her ayın {{fatura_kesim_gunu}}. günü</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e5e7eb;"><strong>KDV Oranı</strong></td>
              <td style="padding: 10px; border: 1px solid #e5e7eb;">%{{kdv_orani}}</td>
            </tr>
          </table>
        </div>
        <div style="padding: 15px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px;">
          Bu e-posta Catering Pro sistem tarafından otomatik gönderilmiştir.
        </div>
      </div>
    `,
  },

  // Genel bildirim
  GENEL_BILDIRIM: {
    subject: '📢 {{baslik}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 20px; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">📢 {{baslik}}</h2>
        </div>
        <div style="padding: 20px; background: #fff; border: 1px solid #e5e7eb; border-top: none;">
          {{icerik}}
        </div>
        <div style="padding: 15px; background: #f3f4f6; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px;">
          Bu e-posta Catering Pro sistem tarafından gönderilmiştir.
        </div>
      </div>
    `,
  },
};

// =====================================================
// MAIL GÖNDERME FONKSİYONLARI
// =====================================================

/**
 * Şablon değişkenlerini doldur
 */
function fillTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

/**
 * E-posta gönder (Resend öncelikli, SMTP fallback)
 */
async function sendMail({ to, subject, html, text, template, data }) {
  try {
    // Şablon kullan
    let finalSubject = subject;
    let finalHtml = html;

    if (template && MAIL_TEMPLATES[template]) {
      finalSubject = fillTemplate(MAIL_TEMPLATES[template].subject, data || {});
      finalHtml = fillTemplate(MAIL_TEMPLATES[template].html, data || {});
    } else if (data) {
      finalSubject = fillTemplate(subject, data);
      finalHtml = fillTemplate(html, data);
    }

    const toAddress = Array.isArray(to) ? to : [to];
    const fromAddress = process.env.MAIL_FROM || 'Catering Pro <onboarding@resend.dev>';
    let messageId = null;

    // Önce Resend dene
    const resend = initResend();
    if (resend) {
      try {
        const { data: resendData, error } = await resend.emails.send({
          from: fromAddress,
          to: toAddress,
          subject: finalSubject,
          html: finalHtml,
          text: text || finalHtml.replace(/<[^>]*>/g, ''),
        });

        if (error) {
          throw new Error(error.message);
        }

        messageId = resendData?.id;
      } catch (resendErr) {
        // SMTP'ye fallback
        const smtp = await initTransporter();
        if (smtp) {
          const info = await smtp.sendMail({
            from: `"Catering Pro" <${process.env.SMTP_USER}>`,
            to: toAddress.join(', '),
            subject: finalSubject,
            html: finalHtml,
            text: text || finalHtml.replace(/<[^>]*>/g, ''),
          });
          messageId = info.messageId;
        } else {
          throw new Error('Mail gönderilemedi: ' + resendErr.message);
        }
      }
    } else {
      // Resend yoksa SMTP kullan
      const smtp = await initTransporter();
      if (!smtp) {
        throw new Error('Mail servisi yapılandırılmamış (RESEND_API_KEY veya SMTP ayarları gerekli)');
      }
      const info = await smtp.sendMail({
        from: `"Catering Pro" <${process.env.SMTP_USER}>`,
        to: toAddress.join(', '),
        subject: finalSubject,
        html: finalHtml,
        text: text || finalHtml.replace(/<[^>]*>/g, ''),
      });
      messageId = info.messageId;
    }

    // Log kaydet
    logAPI('Mail Gönderildi', { to: toAddress, subject: finalSubject, messageId });

    // Veritabanına kaydet
    try {
      await query(
        `
        INSERT INTO mail_logs (alici, konu, sablon, durum, message_id)
        VALUES ($1, $2, $3, 'gonderildi', $4)
      `,
        [toAddress.join(', '), finalSubject, template || null, messageId]
      );
    } catch (dbErr) {
      logger.warn('[MailService] Mail log DB yazma hatasi', { error: dbErr.message });
    }

    return { success: true, messageId };
  } catch (error) {
    logError('Mail Gönderme', error);

    // Hata logla
    try {
      await query(
        `
        INSERT INTO mail_logs (alici, konu, sablon, durum, hata)
        VALUES ($1, $2, $3, 'hata', $4)
      `,
        [to, subject, template || null, error.message]
      );
    } catch (dbErr) {
      logger.warn('[MailService] Mail log DB yazma hatasi', { error: dbErr.message });
    }

    return { success: false, error: error.message };
  }
}

/**
 * Toplu mail gönder
 */
async function sendBulkMail(recipients, { subject, html, template, data }) {
  const results = [];

  for (const recipient of recipients) {
    const recipientData = { ...data, ...recipient.data };
    const result = await sendMail({
      to: recipient.email,
      subject,
      html,
      template,
      data: recipientData,
    });
    results.push({ email: recipient.email, ...result });

    // Rate limiting - saniyede 2 mail
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

// =====================================================
// HATIRLATMA FONKSİYONLARI
// =====================================================

/**
 * Sözleşme bitiş hatırlatmalarını kontrol et
 */
async function checkSozlesmeBitisHatirlatma(gunOnce = 30) {
  try {
    const result = await query(
      `
      SELECT 
        p.id, p.kod, p.ad, p.sozlesme_no, p.sozlesme_bedeli, p.sozlesme_bitis_tarihi,
        p.yetkili, p.email,
        f.email as firma_email
      FROM projeler p
      LEFT JOIN firmalar f ON p.firma_id = f.id
      WHERE p.aktif = TRUE 
        AND p.sozlesme_bitis_tarihi IS NOT NULL
        AND p.sozlesme_bitis_tarihi BETWEEN CURRENT_DATE AND (CURRENT_DATE + $1 * INTERVAL '1 day')
    `,
      [gunOnce]
    );

    const hatirlatmalar = [];

    for (const proje of result.rows) {
      const gun = Math.ceil((new Date(proje.sozlesme_bitis_tarihi) - Date.now()) / (1000 * 60 * 60 * 24));
      const alicilar = [process.env.ADMIN_EMAIL, proje.firma_email, proje.email].filter(Boolean);

      if (alicilar.length > 0) {
        const mailResult = await sendMail({
          to: alicilar,
          template: 'SOZLESME_BITIS',
          data: {
            proje_ad: proje.ad,
            proje_kod: proje.kod,
            sozlesme_no: proje.sozlesme_no || '-',
            bitis_tarihi: new Date(proje.sozlesme_bitis_tarihi).toLocaleDateString('tr-TR'),
            sozlesme_bedeli: (proje.sozlesme_bedeli || 0).toLocaleString('tr-TR'),
            gun: gun,
            link: `${process.env.FRONTEND_URL}/ayarlar?section=projeler&id=${proje.id}`,
          },
        });
        hatirlatmalar.push({ proje: proje.ad, gun, ...mailResult });
      }
    }

    return hatirlatmalar;
  } catch (error) {
    logError('Sözleşme Hatırlatma', error);
    return { error: error.message };
  }
}

/**
 * Teminat iade hatırlatmalarını kontrol et
 */
async function checkTeminatIadeHatirlatma(gunOnce = 30) {
  try {
    const result = await query(
      `
      SELECT 
        p.id, p.ad, p.teminat_mektubu_tutari as teminat_tutari, p.teminat_iade_tarihi,
        f.email as firma_email
      FROM projeler p
      LEFT JOIN firmalar f ON p.firma_id = f.id
      WHERE p.aktif = TRUE 
        AND p.teminat_iade_tarihi IS NOT NULL
        AND p.teminat_mektubu_tutari > 0
        AND p.teminat_iade_tarihi BETWEEN CURRENT_DATE AND (CURRENT_DATE + $1 * INTERVAL '1 day')
    `,
      [gunOnce]
    );

    const hatirlatmalar = [];

    for (const proje of result.rows) {
      const gun = Math.ceil((new Date(proje.teminat_iade_tarihi) - Date.now()) / (1000 * 60 * 60 * 24));
      const alicilar = [process.env.ADMIN_EMAIL, proje.firma_email].filter(Boolean);

      if (alicilar.length > 0) {
        const mailResult = await sendMail({
          to: alicilar,
          template: 'TEMINAT_IADE',
          data: {
            proje_ad: proje.ad,
            teminat_tutari: (proje.teminat_tutari || 0).toLocaleString('tr-TR'),
            iade_tarihi: new Date(proje.teminat_iade_tarihi).toLocaleDateString('tr-TR'),
            gun: gun,
          },
        });
        hatirlatmalar.push({ proje: proje.ad, gun, ...mailResult });
      }
    }

    return hatirlatmalar;
  } catch (error) {
    logError('Teminat Hatırlatma', error);
    return { error: error.message };
  }
}

/**
 * Sertifika yenileme hatırlatmalarını kontrol et
 */
async function checkSertifikaHatirlatma(gunOnce = 60) {
  try {
    // ISO, HACCP, TSE, Halal sertifikaları kontrol et
    const sertifikalar = [
      { kolon: 'iso_sertifika_tarih', ad: 'ISO Sertifikası' },
      { kolon: 'haccp_sertifika_tarih', ad: 'HACCP Sertifikası' },
      { kolon: 'tse_belgesi_tarih', ad: 'TSE Belgesi' },
      { kolon: 'halal_sertifika_tarih', ad: 'Helal Sertifikası' },
    ];

    const hatirlatmalar = [];

    for (const sertifika of sertifikalar) {
      try {
        const result = await query(
          `
          SELECT id, unvan, email, ${sertifika.kolon} as tarih
          FROM firmalar
          WHERE aktif = TRUE 
            AND ${sertifika.kolon} IS NOT NULL
            AND ${sertifika.kolon} BETWEEN CURRENT_DATE AND (CURRENT_DATE + $1 * INTERVAL '1 day')
        `,
          [gunOnce]
        );

        for (const firma of result.rows) {
          const gun = Math.ceil((new Date(firma.tarih) - Date.now()) / (1000 * 60 * 60 * 24));
          const alicilar = [process.env.ADMIN_EMAIL, firma.email].filter(Boolean);

          if (alicilar.length > 0) {
            const mailResult = await sendMail({
              to: alicilar,
              template: 'SERTIFIKA_YENILEME',
              data: {
                firma_unvan: firma.unvan,
                sertifika_adi: sertifika.ad,
                bitis_tarihi: new Date(firma.tarih).toLocaleDateString('tr-TR'),
                gun: gun,
              },
            });
            hatirlatmalar.push({ firma: firma.unvan, sertifika: sertifika.ad, gun, ...mailResult });
          }
        }
      } catch (_err) {}
    }

    return hatirlatmalar;
  } catch (error) {
    logError('Sertifika Hatırlatma', error);
    return { error: error.message };
  }
}

/**
 * Tüm hatırlatmaları çalıştır
 */
async function runAllReminders() {
  const results = {
    sozlesme: await checkSozlesmeBitisHatirlatma(30),
    teminat: await checkTeminatIadeHatirlatma(30),
    sertifika: await checkSertifikaHatirlatma(60),
    tarih: new Date().toISOString(),
  };
  return results;
}

// =====================================================
// EXPORTS
// =====================================================

export {
  initTransporter,
  sendMail,
  sendBulkMail,
  MAIL_TEMPLATES,
  checkSozlesmeBitisHatirlatma,
  checkTeminatIadeHatirlatma,
  checkSertifikaHatirlatma,
  runAllReminders,
};

export default {
  initTransporter,
  sendMail,
  sendBulkMail,
  MAIL_TEMPLATES,
  runAllReminders,
};
