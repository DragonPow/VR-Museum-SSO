# Hướng Dẫn Cấu Hình Xác Thực (Cloudflare Access & API Secret Token)

Tài liệu này hướng dẫn chi tiết cách cấu hình bảo mật trang quản trị (Admin CMS) và API của Phòng Truyền Thống, áp dụng cho cả trường hợp dùng tên miền miễn phí Cloudflare hoặc Custom Domain, đồng thời tự động bypass (không yêu cầu đăng nhập) ở localhost.

---

## PHƯƠNG ÁN 1: Sử dụng Tên miền miễn phí Cloudflare (Khuyên dùng)
Trường hợp bạn sử dụng tên miền mặc định Cloudflare cấp:
* Admin: `virtual-museum-admin.pages.dev`
* API: `virtual-museum-api.vungocthach1112.workers.dev`

### Bước 1: Khóa trang Admin bằng Cloudflare Access
1. Đăng nhập vào [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Vào mục **Access** -> **Applications** -> Bấm **Add an Application**.
3. Chọn **Self-hosted**.
4. Cấu hình thông tin ứng dụng:
   * **Application name:** `Virtual Museum Admin`
   * **Session Duration:** Chọn thời hạn lưu phiên đăng nhập (ví dụ: `1 month` để không bị hỏi đăng nhập lại thường xuyên hoặc `7 days`).
   * **Application domain:** Điền subdomain Pages của bạn: `virtual-museum-admin.pages.dev`.
5. Bấm **Next**.
6. Tại bước cấu hình **Access Policy**:
   * **Policy name:** `Allow Admins`
   * **Action:** `Allow`
   * Trong phần **Include**, chọn **Selector** là **Emails** (hoặc **Emails Ending In** nếu muốn chỉ định đuôi email công ty `@company.com`).
   * Điền danh sách các email của nhân sự ban quản trị được phép truy cập.
7. Bấm **Next** rồi bấm **Add application**.
   *(Giờ đây, bất kỳ ai truy cập vào trang Admin Pages sẽ bắt buộc phải đăng nhập và xác thực OTP qua email mới tải được giao diện).*

### Bước 2: Tạo Token bảo mật cho API (API Secret Token)
Do API chạy trên tên miền `.workers.dev` không thể khóa trực tiếp bằng Cloudflare Access, ta sẽ dùng 1 chuỗi khóa bí mật (Secret Token) để 2 bên xác thực lẫn nhau.

1. **Cấu hình Secret trên API Worker:**
   * Vào Cloudflare Dashboard -> **Workers & Pages** -> Chọn Worker `virtual-museum-api`.
   * Chọn tab **Settings** -> **Variables**.
   * Tại phần **Environment Variables**, bấm **Add**.
   * Điền tên biến là `API_SECRET` và chọn loại là **Secret** (Mã hóa).
   * Giá trị điền một chuỗi ngẫu nhiên dài và bảo mật (ví dụ: `d9f48ac17...`).
   * Bấm **Save and deploy**.

2. **Cấu hình biến môi trường trên Admin Pages:**
   * Vào Cloudflare Dashboard -> **Workers & Pages** -> Chọn Pages `virtual-museum-admin`.
   * Chọn tab **Settings** -> **Environment variables**.
   * Tại phần **Production**, bấm **Add**.
   * Điền tên biến là `VITE_API_SECRET` (loại Text).
   * Giá trị điền **chính xác** chuỗi mật mã bí mật bạn vừa tạo ở Worker phía trên.
   * Bấm **Save**.
   * *Lưu ý:* Sau khi lưu biến môi trường ở Pages, bạn cần thực hiện **Redeploy** (Build lại) project admin để Vite nạp biến môi trường mới vào code.

---

## PHƯƠNG ÁN 2: Sử dụng Custom Domain riêng (Nếu có sau này)
Nếu bạn có một tên miền riêng (ví dụ: `yourcompany.com`) được quản lý trên Cloudflare DNS:

1. **Ghép chung Custom Domain:**
   * Cấu hình Custom Domain cho Admin Pages: `admin.yourcompany.com`.
   * Cấu hình Custom Domain cho Worker API: `api.yourcompany.com` (Thực hiện tại tab Triggers của Worker).
2. **Khóa bằng Cloudflare Access:**
   * Tạo 1 Application bảo vệ `admin.yourcompany.com`.
   * Tạo thêm 1 Application bảo vệ `api.yourcompany.com` (hoặc cấu hình chung rule nếu chạy Worker dạng Route `/api/*`).
   * Bật tùy chọn **Share session database/cookies** cho domain chính `yourcompany.com`.
3. **Hoạt động:**
   * Khi bạn đăng nhập vào Admin, trình duyệt sẽ lưu cookie đăng nhập chung cho cả các subdomain của `yourcompany.com`.
   * Khi gọi API, trình duyệt sẽ tự động gửi kèm cookie này. Cloudflare sẽ chặn mọi cuộc gọi không có cookie hợp lệ từ trước khi chạm vào Worker. Bạn không cần phải cấu hình biến môi trường `API_SECRET` nữa.

---

## 3. Hoạt động tại Localhost

* Do môi trường phát triển cục bộ (`localhost`) chạy trực tiếp từ máy của bạn không đi qua Proxy của Cloudflare Access hay Nginx Basic Auth, nên **tự động không bị chặn đăng nhập**.
* Phía Worker local, nếu bạn không cấu hình `API_SECRET` trong file `.dev.vars` (hoặc để trống), hệ thống sẽ tự động bỏ qua bước kiểm tra xác thực, giúp bạn code bình thường.

---

## 4. Cấu hình dự phòng trên Nginx (Khi chạy Offline / Nội bộ)

Khi công ty yêu cầu mang toàn bộ source code về chạy ở server mạng nội bộ (môi trường không có Internet), bạn có thể bảo vệ trang Admin bằng **Basic Authentication** trực tiếp của Nginx.

Chèn các dòng `auth_basic` vào block cấu hình location của Admin CMS và Proxy API trong file `nginx.conf`:

```nginx
server {
    listen 80;
    server_name admin.local;

    # Bảo vệ trang Admin CMS
    location / {
        root /var/www/virtual-museum-admin;
        index index.html;
        try_files $uri $uri/ /index.html;

        auth_basic "Khu vực quản trị - Yêu cầu đăng nhập";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }

    # Bảo vệ Proxy API
    location /api/ {
        proxy_pass http://localhost:8787; # Cổng chạy worker/api local
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        auth_basic "API Quản trị - Yêu cầu đăng nhập";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```
