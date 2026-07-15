# Deploy Modes

## Content Source Auto Mode

Apps tự chọn nguồn content theo môi trường, có thể override bằng `VITE_CONTENT_MODE=local|github|cloudflare|static`.

| Mode | Khi nào tự chọn | Web/Admin đọc từ đâu |
|---|---|---|
| `local` | `localhost` / `127.0.0.1` | File repo qua `/content/content.json`, fallback `/content/content.sample.json` |
| `github` | host kết thúc bằng `github.io` | File đã build trong GitHub Pages: `<BASE>/content/content.json`, fallback sample |
| `cloudflare` | có `VITE_ASSET_BASE_URL` hoặc admin production có `VITE_API_URL` | Web đọc `<R2>/content.json`; Admin đọc Worker `/api/draft` rồi publish lên R2 |
| `static` | static host khác, không set R2 | `<BASE>/content/content.json`, fallback sample |

Local admin tự serve thư mục repo `/content`, nên không cần mở web dev server chỉ để admin thấy đúng phòng/model local.


## Sample Mode

Muc dich: deploy demo len GitHub Pages hoac bat ky static host nao ma khong co upload/admin production.

- Khong can `VITE_ASSET_BASE_URL`.
- Web tu doc `content/content.json` trong repo, fallback `content/content.sample.json`.
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
