/**
 * Mükerrer Fatura Tespit Servisi
 * Benzer/aynı faturaları tespit eder ve uyarır
 * Claude Sonnet ile AI analizi
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../database.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

class DuplicateDetectorService {
  constructor() {
    this.thresholds = {
      amount: 0.01, // %1 tutar farkı toleransı
      date: 3, // 3 gün tarih farkı toleransı
      similarity: 0.85, // %85 benzerlik oranı
    };
  }

  /**
   * Yeni fatura için mükerrer kontrolü
   */
  async checkForDuplicates(invoice) {
    const suspects = [];

    try {
      // 1. AYNI TUTAR VE AYNI FİRMA kontrolü
      const exactMatches = await query(
        `
        SELECT 
          id, invoice_no, invoice_date, sender_name,
          payable_amount, ettn, created_at,
          'exact_match' as match_type,
          100 as confidence
        FROM uyumsoft_invoices
        WHERE 
          sender_vkn = $1 
          AND ABS(payable_amount - $2) < $3
          AND invoice_date BETWEEN $4::date - INTERVAL '3 days' 
                              AND $4::date + INTERVAL '3 days'
          AND ettn != $5
        ORDER BY invoice_date DESC
        LIMIT 5
      `,
        [
          invoice.sender_vkn,
          invoice.payable_amount,
          invoice.payable_amount * this.thresholds.amount,
          invoice.invoice_date,
          invoice.ettn || 'none',
        ]
      );

      suspects.push(...exactMatches.rows);

      // 2. YAKIN TARİH VE BENZER TUTAR kontrolü
      const similarMatches = await query(
        `
        SELECT 
          id, invoice_no, invoice_date, sender_name,
          payable_amount, ettn, created_at,
          'similar' as match_type,
          CASE 
            WHEN ABS(payable_amount - $2) / $2 < 0.05 THEN 90
            WHEN ABS(payable_amount - $2) / $2 < 0.10 THEN 80
            ELSE 70
          END as confidence
        FROM uyumsoft_invoices
        WHERE 
          sender_vkn = $1
          AND ABS(payable_amount - $2) / $2 < 0.15 -- %15 fark
          AND invoice_date BETWEEN $3::date - INTERVAL '7 days' 
                              AND $3::date + INTERVAL '7 days'
          AND ettn != $4
        ORDER BY ABS(payable_amount - $2) ASC
        LIMIT 5
      `,
        [invoice.sender_vkn, invoice.payable_amount, invoice.invoice_date, invoice.ettn || 'none']
      );

      suspects.push(...similarMatches.rows);

      // 3. FATURA NUMARASI benzerliği
      if (invoice.invoice_no) {
        const invoiceNoMatches = await query(
          `
          SELECT 
            id, invoice_no, invoice_date, sender_name,
            payable_amount, ettn, created_at,
            'invoice_no_similar' as match_type,
            CASE 
              WHEN invoice_no = $1 THEN 95
              WHEN similarity(invoice_no, $1) > 0.8 THEN 85
              ELSE 75
            END as confidence
          FROM uyumsoft_invoices
          WHERE 
            sender_vkn = $2
            AND (
              invoice_no = $1 
              OR similarity(invoice_no, $1) > 0.7
            )
            AND ettn != $3
          ORDER BY similarity(invoice_no, $1) DESC
          LIMIT 3
        `,
          [invoice.invoice_no, invoice.sender_vkn, invoice.ettn || 'none']
        );

        suspects.push(...invoiceNoMatches.rows);
      }

      // 4. AI ile derin analiz (opsiyonel - yavaş)
      if (suspects.length > 0 && process.env.ENABLE_AI_DUPLICATE_CHECK === 'true') {
        const aiAnalysis = await this.analyzeWithAI(invoice, suspects);
        return {
          hasDuplicates: suspects.length > 0,
          suspects: aiAnalysis.enrichedSuspects,
          recommendation: aiAnalysis.recommendation,
          riskLevel: aiAnalysis.riskLevel,
        };
      }

      // Sonuçları skorla ve sırala
      const scoredSuspects = this.scoreSuspects(invoice, suspects);

      return {
        hasDuplicates: suspects.length > 0,
        suspects: scoredSuspects,
        highRisk: scoredSuspects.filter((s) => s.confidence >= 85),
        mediumRisk: scoredSuspects.filter((s) => s.confidence >= 70 && s.confidence < 85),
        lowRisk: scoredSuspects.filter((s) => s.confidence < 70),
      };
    } catch (error) {
      return {
        hasDuplicates: false,
        suspects: [],
        error: error.message,
      };
    }
  }

  /**
   * Şüpheli faturaları skorla
   */
  scoreSuspects(invoice, suspects) {
    const uniqueSuspects = new Map();

    for (const suspect of suspects) {
      const key = suspect.id;

      if (!uniqueSuspects.has(key) || uniqueSuspects.get(key).confidence < suspect.confidence) {
        // Detaylı analiz ekle
        suspect.analysis = {
          amountDiff: Math.abs(suspect.payable_amount - invoice.payable_amount),
          amountDiffPercent: Math.abs(
            ((suspect.payable_amount - invoice.payable_amount) / invoice.payable_amount) * 100
          ),
          daysDiff: Math.abs(
            Math.floor((new Date(invoice.invoice_date) - new Date(suspect.invoice_date)) / (1000 * 60 * 60 * 24))
          ),
          invoiceNoMatch: invoice.invoice_no === suspect.invoice_no,
          sameVendor: true, // zaten VKN ile filtreledik
        };

        uniqueSuspects.set(key, suspect);
      }
    }

    return Array.from(uniqueSuspects.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * AI ile derin analiz (Claude Sonnet)
   */
  async analyzeWithAI(invoice, suspects) {
    try {
      const prompt = `
Aşağıdaki faturayı ve şüpheli mükerrer faturaları analiz et:

YENİ FATURA:
- Fatura No: ${invoice.invoice_no}
- Tarih: ${invoice.invoice_date}
- Firma: ${invoice.sender_name}
- Tutar: ${invoice.payable_amount} TL
- ETTN: ${invoice.ettn}

ŞÜPHELİ MÜKERRER FATURALAR:
${suspects
  .map(
    (s, i) => `
${i + 1}. Fatura:
   - No: ${s.invoice_no}
   - Tarih: ${s.invoice_date}
   - Tutar: ${s.payable_amount} TL
   - Tespit Tipi: ${s.match_type}
   - Güven: %${s.confidence}
`
  )
  .join('\n')}

Analiz et ve JSON formatında yanıt ver:
\`\`\`json
{
  "isDuplicate": true/false,
  "riskLevel": "high/medium/low",
  "mostLikelyDuplicate": {
    "invoiceNo": "...",
    "reason": "..."
  },
  "recommendation": "...",
  "enrichedSuspects": [
    {
      "invoiceNo": "...",
      "isDuplicateProbability": 0-100,
      "reasoning": "..."
    }
  ]
}
\`\`\`
`;

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = response.content[0]?.text || '';

      // JSON parse
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      return {
        riskLevel: 'unknown',
        recommendation: 'AI analizi başarısız',
        enrichedSuspects: suspects,
      };
    } catch (_error) {
      return {
        riskLevel: 'unknown',
        recommendation: 'Otomatik analiz',
        enrichedSuspects: suspects,
      };
    }
  }

  /**
   * Toplu mükerrer kontrolü
   */
  async batchCheck(startDate, endDate) {
    const report = {
      totalInvoices: 0,
      duplicateGroups: [],
      totalDuplicates: 0,
      savedAmount: 0,
    };
    // Tüm faturaları al
    const invoices = await query(
      `
        SELECT * FROM uyumsoft_invoices
        WHERE invoice_date BETWEEN $1 AND $2
        ORDER BY sender_vkn, invoice_date
      `,
      [startDate, endDate]
    );

    report.totalInvoices = invoices.rows.length;

    // Her fatura için kontrol et
    const processed = new Set();

    for (const invoice of invoices.rows) {
      if (processed.has(invoice.id)) continue;

      const duplicates = await this.checkForDuplicates(invoice);

      if (duplicates.highRisk && duplicates.highRisk.length > 0) {
        const group = {
          original: invoice,
          duplicates: duplicates.highRisk,
          totalAmount:
            invoice.payable_amount + duplicates.highRisk.reduce((sum, d) => sum + parseFloat(d.payable_amount), 0),
        };

        report.duplicateGroups.push(group);
        report.totalDuplicates += duplicates.highRisk.length;
        report.savedAmount += duplicates.highRisk.reduce((sum, d) => sum + parseFloat(d.payable_amount), 0);

        // İşlenenleri işaretle
        processed.add(invoice.id);
        for (const d of duplicates.highRisk) {
          processed.add(d.id);
        }
      }
    }

    return report;
  }

  /**
   * Mükerrer olarak işaretle
   */
  async markAsDuplicate(originalId, duplicateId, confidence) {
    try {
      await query(
        `
        INSERT INTO invoice_duplicates (
          original_invoice_id,
          duplicate_invoice_id,
          confidence,
          detected_at,
          status
        ) VALUES ($1, $2, $3, NOW(), 'pending_review')
      `,
        [originalId, duplicateId, confidence]
      );

      // Duplicate faturayı işaretle
      await query(
        `
        UPDATE uyumsoft_invoices
        SET 
          is_duplicate = true,
          duplicate_of = $1,
          updated_at = NOW()
        WHERE id = $2
      `,
        [originalId, duplicateId]
      );

      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Otomatik temizlik önerisi
   */
  async getSavingsReport() {
    const result = await query(`
      SELECT 
        COUNT(*) as duplicate_count,
        SUM(payable_amount) as potential_savings,
        COUNT(DISTINCT sender_vkn) as affected_vendors
      FROM uyumsoft_invoices
      WHERE is_duplicate = true
        AND is_approved = false
    `);

    return {
      duplicateCount: result.rows[0].duplicate_count,
      potentialSavings: result.rows[0].potential_savings,
      affectedVendors: result.rows[0].affected_vendors,
      recommendation:
        result.rows[0].potential_savings > 10000
          ? 'Yüksek tasarruf potansiyeli! Hemen inceleyin.'
          : 'Düzenli kontrol yapın.',
    };
  }
}

export default new DuplicateDetectorService();
