# Fahm-e-Salaf — Frontend

React 18 + Vite + Tailwind + react-router. Zero extra runtime deps.

```bash
cp .env.example .env     # set VITE_API_BASE_URL, social links
npm install && npm run dev
```

## Structure
- `src/index.css`, `tailwind.config.js` — design tokens (Light / Sepia / Dark themes, Quran.com palette; admin uses the same palette)
- `src/i18n/` — Roman / Hindi / Urdu dictionaries (RTL auto for Urdu)
- `src/lib/script.js` — per-text script detection (Urdu Nastaliq / Arabic Naskh / Devanagari / Latin)
- `src/components/` — brand, ui, public, article (BlockRenderer, ReferenceCard, ScanViewer)
- `src/pages/public/` — Home, Aqaid/Masail, Topic, Article
- `src/admin/` — lazy-loaded admin (`/admin`): CRUD, block editor, preview
- `src/lib/blocks.js` — block field shapes (frontend-owned contract)

## Backend additions (additive, required by the frontend)
- CORS now allows `PATCH`
- `POST /api/admin/media` (upload → R2) and `GET /api/public/media/:key`
- `divider` block type
- Topic: `intro`, `coverKey` — Article: `section` (dalail|radd), `excerpt`, `seoTitle`, `seoDescription`, `coverKey`

## Deploy note
Auth cookie is `SameSite=Lax` — serve frontend and API from the same site
(e.g. `app.example.com` + `api.example.com`) or cross-site requests won't carry the cookie.
