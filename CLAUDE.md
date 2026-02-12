# CLAUDE.md - Catering Pro

> Detayli kurallar: `.cursor/rules/` altindaki `.mdc` dosyalarinda.

## Hizli Referans

- **Frontend**: `cd frontend && npm run dev` (port 3000)
- **Backend**: `cd backend && npm run dev` (port 3001)
- **Check**: `cd frontend && npm run check` / `cd backend && npm run check`
- **Deploy**: `./scripts/deploy.sh frontend` veya `./scripts/deploy.sh backend`
- **SSH**: `ssh -i ~/.ssh/procheff_deploy root@46.101.172.210`
- **PM2 logs**: `ssh -i ~/.ssh/procheff_deploy root@46.101.172.210 "pm2 logs --lines 50"`

## Commit Kurallari

- Prefix: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Co-Author: `Co-Authored-By: Claude <noreply@anthropic.com>`
- Pre-commit hook: API URL ve hassas veri kontrolu yapar
