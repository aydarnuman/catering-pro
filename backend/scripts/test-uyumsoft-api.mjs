#!/usr/bin/env node
/**
 * Uyumsoft e-Fatura API bağlantı testi
 * Kullanım:
 *   node scripts/test-uyumsoft-api.mjs
 *   UYUMSOFT_USERNAME=kullanici UYUMSOFT_PASSWORD=sifre node scripts/test-uyumsoft-api.mjs
 * Önce /connect ile giriş yapıldıysa storage'daki kayıtlı bilgiler kullanılır.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/.env ve proje kökü .env yükle (env'deki UYUMSOFT_* buradan gelir)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });
const API_ENDPOINT = 'https://efatura.uyumsoft.com.tr/Services/Integration';
const SOAP_ACTION = 'http://tempuri.org/IIntegration/TestConnection';

function createEnvelope(username, password) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://tempuri.org/"
               xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soap:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${username}</wsse:Username>
        <wsse:Password>${password}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <tns:TestConnection />
  </soap:Body>
</soap:Envelope>`;
}

async function loadCredentialsFromStorage() {
  const sessionPath = path.join(__dirname, '../storage/uyumsoft-session.json');
  if (!fs.existsSync(sessionPath)) return null;
  try {
    const crypto = await import('node:crypto');
    const data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    const key = (process.env.UYUMSOFT_ENCRYPTION_KEY || 'uyumsoft-catering-secret-key32!!').slice(0, 32);
    const decrypt = (text) => {
      const [ivHex, encHex] = text.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const enc = Buffer.from(encHex, 'hex');
      const d = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
      return Buffer.concat([d.update(enc), d.final()]).toString();
    };
    return {
      username: decrypt(data.username),
      password: decrypt(data.password),
    };
  } catch (e) {
    console.warn('Storage decrypt hatası:', e.message);
    return null;
  }
}

async function main() {
  let username = process.env.UYUMSOFT_USERNAME?.trim();
  let password = process.env.UYUMSOFT_PASSWORD;

  if (!username || !password) {
    const stored = await loadCredentialsFromStorage();
    if (stored) {
      username = stored.username;
      password = stored.password;
      console.log('Kayıtlı kimlik bilgileri kullanılıyor (storage).');
    }
  } else {
    console.log('Env (.env) üzerinden UYUMSOFT_USERNAME / UYUMSOFT_PASSWORD kullanılıyor.');
  }

  if (!username || !password) {
    console.error('Hata: Kimlik bilgisi yok.');
    console.error('  .env içinde UYUMSOFT_USERNAME ve UYUMSOFT_PASSWORD tanımlayın veya uygulama içinden giriş yapın.');
    process.exit(1);
  }

  console.log('Uyumsoft API test ediliyor:', API_ENDPOINT);
  console.log('Kullanıcı:', username);

  const envelope = createEnvelope(username, password);

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 30000);
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: SOAP_ACTION,
      },
      body: envelope,
      signal: ac.signal,
    });
    clearTimeout(t);

    const text = await res.text();
    console.log('\nHTTP Durum:', res.status, res.statusText);
    if (text.length < 800) {
      console.log('Yanıt (ham):', text);
    } else {
      console.log('Yanıt (ilk 800 karakter):', text.slice(0, 800));
    }

    const parsed = await parseStringPromise(text, {
      explicitArray: false,
      ignoreAttrs: false,
      tagNameProcessors: [(n) => n.replace(/^.*:/, '')],
    });

    const body = parsed?.Envelope?.Body ?? parsed?.body ?? parsed;
    const fault = body?.Fault ?? body?.fault;
    const testResult = body?.TestConnectionResponse?.TestConnectionResult
      ?? body?.testConnectionResponse?.testConnectionResult;

    if (fault) {
      const reason = fault?.Reason?.Text ?? fault?.reason?.text ?? fault?.faultstring ?? JSON.stringify(fault);
      console.error('\nSOAP Fault:', reason);
      process.exit(2);
    }

    if (testResult) {
      const attrs = testResult.$ ?? testResult;
      const ok = attrs.IsSucceded === 'true' || attrs.IsSucceeded === 'true';
      const msg = attrs.Message ?? attrs.Message ?? '';
      console.log('\nTestConnection sonucu:', ok ? 'BAŞARILI' : 'BAŞARISIZ', msg || '(mesaj yok)');
      if (!ok) process.exit(3);
    } else {
      console.log('\nParse edilen yapı (Body altı):', JSON.stringify(body, null, 2).slice(0, 1200));
      process.exit(4);
    }
  } catch (err) {
    console.error('İstek hatası:', err.message);
    if (err.cause) console.error('Cause:', err.cause);
    process.exit(5);
  }
}

main();
