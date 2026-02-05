# Football Booking – Public FE

Giao diện công tích đặt sân bóng online. Người dùng không cần tạo tài khoản, chỉ cần chọn sân → chọn thời gian → nhập thông tin → đặt sẽ hoàn thành.

---

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Framework | React 18 (Create React App) |
| CSS | Tailwind CSS 3.4 |
| Icons | Lucide React |
| HTTP | Native Fetch API |
| State | React Hooks (`useState`, `useEffect`) |
| Config | `.env` (Environment Variables) |

---

## Cấu trúc thư mục

```
football-public-FE/
├── public/
│   └── index.html               # HTML template (lang="vi")
├── src/
│   ├── index.js                 # Entry point – render app
│   ├── index.css                # Tailwind directives + global reset
│   └── PublicBookingPage.jsx    # Component chính (toàn bộ booking flow)
├── .env                         # Biến môi trường (active)
├── .env.example                 # Template biến môi trường
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

> Hiện tại app chỉ có **1 page** (`PublicBookingPage`). Toàn bộ logic booking, API call, và UI đều nằm trong file này.

---

## Setup & Run

### 1. Cài dependencies

```bash
npm install
```

### 2. Tạo file `.env`

Copy từ `.env.example` và điền giá trị:

```bash
cp .env.example .env
```

Các biến cần thiết:

| Biến | Mô tả | Default |
|---|---|---|
| `REACT_APP_API_URL` | Base URL của backend | `http://localhost:5000` |
| `REACT_APP_API_BASE_URL` | API base path | `http://localhost:5000/api` |
| `REACT_APP_PUBLIC_API_URL` | Public API endpoint (được dùng trong app) | `http://localhost:5000/api/public` |
| `PORT` | Port dev server | `3001` |

> **Note:** Production URL là `https://thientran-booking.appscyclone.com` – uncomment trong `.env` khi deploy.

### 3. Start dev server

```bash
npm start
```

App sẽ chạy tại `http://localhost:3001`.

### 4. Build production

```bash
npm run build
```

Output vào thư mục `build/`.

---

## API Endpoints

App gọi các endpoint sau từ backend (prefix: `REACT_APP_PUBLIC_API_URL`):

| Endpoint | Method | Mô tả |
|---|---|---|
| `/fields` | `GET` | Lấy danh sách toàn bộ sân bóng |
| `/fields/search-available` | `GET` | Tìm sân còn trống theo `date`, `startTime`, `endTime` |
| `/customers/find-or-create` | `POST` | Tạo hoặc tìm customer theo số điện thoại |
| `/bookings` | `POST` | Tạo booking mới |

### Response format

```json
{
  "success": true,
  "data": { ... },
  "message": "..."
}
```

### Ví dụ: Tạo booking

```json
POST /bookings
{
  "userId": "...",
  "fieldId": "...",
  "bookingDate": "2025-01-15",
  "startTime": "08:00",
  "endTime": "10:00",
  "duration": 2,
  "totalPrice": 200000,
  "notes": "..."
}
```

---

## Booking Flow (4 bước)

```
[1] Chọn sân  →  [2] Chọn thời gian  →  [3] Nhập thông tin  →  [4] Xác nhận
```

| Bước | Mô tả |
|---|---|
| **1 – Chọn sân** | Hiển thị danh sách sân. Hỗ trợ search theo tên/địa chỉ và filter theo ngày-giờ trống. |
| **2 – Chọn thời gian** | Chọn ngày, start/end time. Auto-tính duration và tổng giá. |
| **3 – Thông tin khách** | Nhập số điện thoại (10 chữ số, bắt đầu bằng `0`) và tên. Backend tự tạo customer nếu chưa có. |
| **4 – Xác nhận** | Hiển thị tóm tắt booking. Có thể đặt thêm sân. |

---

## Validation

- Số điện thoại: 10 chữ số, bắt đầu bằng `0`
- End time phải sau start time
- Chỉ cho đặt ngày hôm nay hoặc tương lai
- Sân inactive sẽ bị lọc ra
- Tất cả error message hiển thị bằng tiếng Việt

---

## Notes

- Toàn bộ UI text và currency formatting đều bằng tiếng Việt (VND).
- App không có authentication – đây là giao diện public.
- Backend cần chạy trước khi start frontend (hoặc trỏ `REACT_APP_PUBLIC_API_URL` đến production).
