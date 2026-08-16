# ELSU-LIKE DEMO / TEST SYSTEM

Bu layihə REAL ELSU sistemi deyil. Real universitet serverinə, real tələbə hesablarına və real universitet məlumat bazasına qoşulmur.

## Struktur

- `frontend/` — Netlify üçün statik frontend
- `backend/` — Node.js + Express API, Render üçün
- `database/schema.sql` — Neon PostgreSQL üçün schema

## 1. Neon

`database/schema.sql` faylını Neon SQL Editor-də işlədin.

## 2. Render

GitHub repository-dən `backend` qovluğunu Web Service kimi deploy edin.

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`

Environment Variables:

- `DATABASE_URL` — Neon connection string
- `JWT_SECRET` — uzun, təsadüfi secret
- `FRONTEND_ORIGIN` — Netlify saytınızın tam URL-i
- `SEED_STUDENT_PASSWORD` — öz seçdiyiniz demo tələbə şifrəsi
- `SEED_ADMIN_PASSWORD` — öz seçdiyiniz demo admin şifrəsi
- `NODE_ENV=production`

Seed-i bir dəfə işə salmaq üçün Render Shell-də:

`npm run seed`

## 3. Netlify

`frontend/` qovluğunu Netlify-də deploy edin.

Render backend URL-i məlum olduqdan sonra `frontend/config.js` faylında:

`window.ELSU_API_BASE_URL = "http://localhost:5000";`

sətirini Render URL-i ilə dəyişin və frontend-i yenidən deploy edin.

## Təhlükəsizlik

- Real ELSU məlumatlarından istifadə etməyin.
- `.env` faylını GitHub-a yükləməyin.
- Şifrələri frontend koduna yazmayın.
- `JWT_SECRET` və database credentials yalnız Render Environment Variables-da saxlanmalıdır.
- Tələbə portalında imtahan balı göstərilmir; imtahan nəticəsini yalnız admin idarə edir.
