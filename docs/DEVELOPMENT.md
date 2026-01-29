# 🚀 Lokal Geliştirme Ortamı

## 📋 Gereksinimler

- Node.js v20+
- npm
- PostgreSQL (Supabase kullanıyoruz, lokal DB'ye gerek yok)

---

## 🛠️ Kurulum

### 1. Backend'i Başlat

```bash
cd backend
npm install
npm start
# ✅ Backend: http://localhost:3001
```

### 2. Frontend'i Başlat (Yeni Terminal)

```bash
cd frontend
npm install
npm run dev
# ✅ Frontend: http://localhost:3000
```

---

## 🔄 Geliştirme Workflow'u

### Anlık Değişiklikleri Test Et

**Frontend (Next.js):**
- Dosyayı kaydet
- Tarayıcı otomatik yenilenir (Hot Reload)
- http://localhost:3000 üzerinden test et

**Backend (Express):**
- Dosyayı kaydet
- Manuel restart gerekir: `Ctrl+C` → `npm start`
- Veya `nodemon` kullan (aşağıda açıklaması var)

---

## 🎯 Environment Variables

### Lokal Geliştirme

| Dosya | Kullanım |
|-------|----------|
| `backend/.env` | Supabase + Gemini credentials |

### Production (Sunucu)

| Dosya | Kullanım |
|-------|----------|
| `backend/.env` | Supabase + Gemini credentials |

> **NOT:** Frontend artık `NEXT_PUBLIC_API_URL` env variable'a ihtiyaç duymuyor. 
> `config.ts` runtime'da hostname'e göre otomatik belirliyor.

---

## 🌐 API URL Kullanımı (ÖNEMLİ!)

Frontend'de **ASLA** hardcoded URL kullanma:

```typescript
// ❌ YANLIŞ
const API_URL = 'http://localhost:3001/api';
fetch('http://localhost:3001/api/cariler');

// ✅ DOĞRU
import { API_BASE_URL } from '@/lib/config';
fetch(`${API_BASE_URL}/api/cariler`);
```

### Nasıl Çalışıyor?

| Ortam | hostname | API_BASE_URL |
|-------|----------|--------------|
| Local | `localhost` | `http://localhost:3001` |
| Production | `46.101.172.210` | `http://46.101.172.210` |

Hiçbir env dosyası değiştirmene gerek yok - **aynı kod her yerde çalışır!**

---

## 🔥 Hot Reload için Nodemon (Opsiyonel)

Backend'de her değişiklikte otomatik restart için:

```bash
cd backend
npm install --save-dev nodemon
```

`backend/package.json`'a ekle:

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  }
}
```

Artık:

```bash
npm run dev  # Backend otomatik restart olur
```

---

## 📦 Deployment'e Push

Lokal değişiklikleri test ettikten sonra:

```bash
# 1. Commit yap
git add .
git commit -m "feat: Yeni özellik"

# 2. GitHub'a push
git push origin main

# 3. Sunucuda güncelle (SSH ile)
ssh root@46.101.172.210
cd /root/catering-pro
git pull
cd frontend && npm run build && pm2 restart catering-frontend
```

---

## 🐛 Sorun Giderme

### Frontend localhost:3001'e bağlanamıyor

```bash
# Backend çalışıyor mu kontrol et
curl http://localhost:3001/api/health
```

### Backend database'e bağlanamıyor

```bash
# .env dosyasında DATABASE_URL doğru mu?
cat .env | grep DATABASE_URL
```

### Port zaten kullanımda

```bash
# 3001 portunu kim kullanıyor?
lsof -ti:3001 | xargs kill -9

# 3000 portunu kim kullanıyor?
lsof -ti:3000 | xargs kill -9
```

---

## 📱 Mobil Test (Aynı Ağdaki Telefon)

1. Mac IP'nizi öğrenin:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# Örnek: 192.168.1.100
```

2. Frontend'te `.env.local`:
```
NEXT_PUBLIC_API_URL=http://192.168.1.100:3001
```

3. Telefondan:
```
http://192.168.1.100:3000
```

---

## 🎨 IDE Extensions (VS Code)

- **ES7+ React/Redux/React-Native snippets** - Hızlı snippet'ler
- **Prettier** - Kod formatlama
- **ESLint** - Linting
- **Tailwind CSS IntelliSense** - Tailwind autocomplete

---

## 🚀 Production vs Development

| Özellik | Development | Production |
|---------|-------------|------------|
| **Frontend** | `npm run dev` | `npm run build` + `npm start` |
| **Backend** | `npm start` | PM2 ile çalışır |
| **Hot Reload** | ✅ Var | ❌ Yok |
| **Source Maps** | ✅ Var | ❌ Yok |
| **Minification** | ❌ Yok | ✅ Var |

---

## 📝 Notlar

- **.env dosyaları GIT'e eklenmez** (.gitignore'da)
- **Sensitive bilgiler sadece lokal** olmalı
- **Production'a push etmeden önce test et**
