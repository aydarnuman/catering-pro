# Config Module

Merkezi yapılandırma modülü. Tüm uygulama ayarları burada tanımlanır.

## Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `scraper.config.js` | Scraper ayarları (timeout, URL, session) |
| `ai.config.js` | AI/Claude ayarları (model, token, queue) |
| `storage.config.js` | Storage ayarları (bucket, MIME types) |
| `index.js` | Merkezi export |

## Kullanım

```javascript
// Tek config
import { scraperConfig } from './config';
console.log(scraperConfig.timeouts.navigation);

// Tüm config'ler
import { scraperConfig, aiConfig, storageConfig } from './config';
```

## Environment Variables

Config'ler environment variable'lardan okunur, varsayılan değerler tanımlıdır.

```javascript
// Örnek: scraper.config.js
export const scraperConfig = {
  timeouts: {
    navigation: parseInt(process.env.SCRAPER_NAV_TIMEOUT || '30000', 10),
  }
};
```

## Yeni Config Ekleme

1. `config/` klasöründe yeni dosya oluşturun: `my-feature.config.js`
2. `index.js`'e export ekleyin
3. Varsayılan değerleri env variable'lardan okuyun
