# Huong dan cau hinh Cloudflare Access cho Admin CMS

Tai lieu nay dung cho huong **khong tao them Worker moi, khong tao them Pages moi**. Admin page va cac API quan tri duoc bao ve bang Cloudflare Access theo hostname/path; public web van doc asset tu R2 public URL va van goi API dem luot tham quan.

## Trang hien co

- Admin CMS: `https://virtual-museum-admin.pages.dev`
- Public web: `https://virtual-museum-web.pages.dev`
- API Worker: `https://virtual-museum-api.vungocthach1112.workers.dev`
- R2 public assets: `https://pub-45a113bbee6b43d58d9cc91bd6e1189c.r2.dev`

## Nguyen tac bao mat

- Khong dat secret trong frontend Vite. Khong dung `VITE_API_SECRET`.
- Cloudflare Access chan cac route admin truoc khi request cham vao Worker.
- Cac endpoint public cua public web khong bi Access chan.

## Route can khoa bang Access

Khoa cac path sau tren API Worker:

- `/api/draft*`
- `/api/upload*`
- `/api/publish*`
- `/api/stats*`

De public cac path sau:

- `/api/health`
- `/api/content`
- `/api/documents/*`
- `/api/visit`
- `/api/visitor-count`
- `/content/*`
- `/media/*`

Ly do: public web dang doc `content.json`, document, anh, model tu R2 public URL; rieng landing page van goi `/api/visit` va `/api/visitor-count` de dem luot tham quan.

## Cach cau hinh trong Cloudflare Zero Trust

1. Vao **Cloudflare Zero Trust** -> **Access** -> **Applications**.
2. Tao hoac cau hinh mot **Self-hosted application** cho admin.
3. Khuyen dung dat admin page va cac route admin API trong **cung mot Access application** neu UI cho phep them nhieu hostname/path:
   - `virtual-museum-admin.pages.dev` voi path rong hoac `/*`
   - `virtual-museum-api.vungocthach1112.workers.dev` voi path `/api/draft*`
   - `virtual-museum-api.vungocthach1112.workers.dev` voi path `/api/upload*`
   - `virtual-museum-api.vungocthach1112.workers.dev` voi path `/api/publish*`
   - `virtual-museum-api.vungocthach1112.workers.dev` voi path `/api/stats*`
4. Tao policy:
   - Action: `Allow`
   - Include: danh sach email admin hoac email domain noi bo
5. Khong tao policy `Include Everyone` cho admin/API route quan tri.

Neu Cloudflare UI khong cho them nhieu hostname/path trong cung application, tao 2 Access applications:

- `Virtual Museum Admin` cho `virtual-museum-admin.pages.dev`
- `Virtual Museum Admin API` cho 4 path admin API o tren

Trong truong hop tach 2 application, trinh duyet co the can login Access cho API domain lan dau. Neu gap CORS/login redirect, mo truc tiep mot URL admin API nhu `https://virtual-museum-api.vungocthach1112.workers.dev/api/draft`, dang nhap Access, sau do quay lai admin CMS.

## Cau hinh CORS cho Access-protected API routes

Admin goi API cross-origin tu `virtual-museum-admin.pages.dev` sang `workers.dev`, nen trong Access application cua API can vao **Advanced settings** -> **Cross-Origin Resource Sharing (CORS)** va cau hinh mot trong hai cach:

### Cach khuyen dung

Bat **Bypass OPTIONS requests to origin**. Worker hien da tra CORS preflight cho `OPTIONS`.

### Hoac de Access tu tra preflight

Cau hinh CORS settings:

- Allow Origin: `https://virtual-museum-admin.pages.dev`
- Allow Methods: `GET, POST, DELETE, OPTIONS`
- Allow Headers: `Content-Type`
- Allow Credentials: `true`

## Bien moi truong can giu

Admin Pages:

```env
VITE_API_URL=https://virtual-museum-api.vungocthach1112.workers.dev
```

Public Web Pages:

```env
VITE_ASSET_BASE_URL=https://pub-45a113bbee6b43d58d9cc91bd6e1189c.r2.dev
VITE_API_URL=https://virtual-museum-api.vungocthach1112.workers.dev
```

API Worker vars:

```env
ALLOWED_ORIGIN=https://virtual-museum-admin.pages.dev,https://virtual-museum-web.pages.dev
PUBLIC_R2_URL=https://pub-45a113bbee6b43d58d9cc91bd6e1189c.r2.dev
```

Khong can `API_SECRET` hoac `VITE_API_SECRET`.

## Checklist sau khi deploy

1. Mo admin page an danh -> phai bi Cloudflare Access bat dang nhap.
2. Dang nhap bang email admin -> admin page load duoc.
3. Thu doc draft, upload anh nho, publish.
4. Mo public web an danh -> content/anh/model tu R2 van load.
5. Landing page van ghi `/api/visit` va doc `/api/visitor-count`.
6. Thu truy cap truc tiep `/api/publish` khi chua dang nhap -> phai bi Access chan.
