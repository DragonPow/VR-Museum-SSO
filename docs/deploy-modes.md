# Deploy Modes

## Sample Mode

Muc dich: deploy demo len GitHub Pages hoac bat ky static host nao ma khong co upload/admin production.

- Khong can `VITE_ASSET_BASE_URL`.
- Web tu doc `content/content.sample.json` trong repo.
- Model mau duoc lay tu `content/models/truyenthong.glb`.
- Neu deploy duoi sub-path, set `VITE_BASE_URL`.

Vi du GitHub Pages:

```env
VITE_BASE_URL=/VR-Museum-SSO/
```

Khi build xong, site se chay ngay voi du lieu mau da commit san trong repo.

## Cloudflare Mode

Muc dich: moi truong chinh de team noi dung upload anh/model va publish noi dung that.

- Set `VITE_ASSET_BASE_URL` bang custom domain hoac public domain cua R2.
- Web/admin se tu resolve cac duong dan sau tu cung 1 base:
  - `content.json`
  - `content/models/*.glb`
  - `media/*`

Vi du:

```env
VITE_ASSET_BASE_URL=https://assets.example.com
```

Khi do app se doc:

```text
https://assets.example.com/content.json
https://assets.example.com/content/models/truyenthong.glb
https://assets.example.com/media/...
```

## Admin Note

Admin van can `VITE_API_URL` de goi Worker cho cac tac vu:

- load/save draft
- upload anh
- upload model
- publish `content.json`

`VITE_ASSET_BASE_URL` chi dung de preview dung dung asset host production.
