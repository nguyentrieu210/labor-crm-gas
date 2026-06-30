# Push trực tiếp lên Apps Script bằng clasp (khỏi copy tay)

Máy bạn đã có sẵn: **node v24, npm 11, clasp 3.3.0** → không cần cài gì thêm.
Folder này đã chuẩn bị sẵn `appsscript.json`, `.claspignore`, `.clasp.json.example`.

## Chuẩn bị 1 lần
1. Bật Apps Script API: mở https://script.google.com/home/usersettings → bật **Apps Script API**.
2. Đăng nhập clasp (mở trình duyệt):
   ```
   clasp login
   ```

## Cách A — dùng Google Sheet bạn TỰ tạo (khuyến nghị, dễ kiểm soát)
1. Tạo 1 Google Sheet trống → **Tiện ích mở rộng → Apps Script**.
2. Trong Apps Script: **⚙️ Cài đặt dự án (Project Settings)** → copy **ID tập lệnh (Script ID)**.
3. Trong folder này, đổi tên `.clasp.json.example` → `.clasp.json` rồi dán Script ID vào:
   ```
   { "scriptId": "ID_VỪA_COPY", "rootDir": "." }
   ```
4. Mở terminal trong folder này và đẩy code:
   ```
   cd "C:\Users\Admin\Documents\exel\AppsScript\labor_crm_gas"
   clasp status        # xem trước những file sẽ push
   clasp push -f       # -f để ghi đè manifest mặc định lần đầu
   ```
5. Quay lại Apps Script (reload trang). Chạy `setupAll` (cấp quyền) → `seedDemo` → `runKpiTests`.
6. **Deploy → New deployment → Web app** để lấy link mini-app.

## Cách B — để clasp TẠO Sheet mới tự động
```
cd "C:\Users\Admin\Documents\exel\AppsScript\labor_crm_gas"
clasp create --type sheets --title "Labor CRM"   # tạo Sheet mới + .clasp.json
clasp push -f
```
> Nếu lệnh create ghi đè `appsscript.json` bằng bản mặc định, đẩy lại bản của ta: `clasp push -f`.
> (Cách A an toàn hơn vì giữ nguyên `appsscript.json` đã cấu hình múi giờ + web app.)

## Vòng lặp làm việc sau này
```
# AI/bạn sửa file .gs/.html ở local → đẩy lên:
clasp push
# hoặc tự push mỗi khi lưu file:
clasp push -w
```
Sau khi push, **reload Google Sheet** để thấy menu mới; với Web App, nếu sửa code thì
**Deploy → Manage deployments → ✏️ → Version: New version** để cập nhật link cũ.

## Lưu ý
- `clasp push` đẩy TOÀN BỘ file local lên (ghi đè remote). File `.md`, `.example` không bị đẩy
  (clasp chỉ push `.gs`, `.html`, `appsscript.json`).
- Code KHÔNG chạy ở máy local — local chỉ là nơi sửa; chạy thật trên Apps Script sau khi push.
- Nguồn: https://github.com/google/clasp
