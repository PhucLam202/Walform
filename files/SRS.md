# SRS — WalForm: Decentralized Form & Feedback Platform
> Walrus Session 2 Hackathon · Solo Build · Deadline: 18/5/2026

---

## 1. Overview

**Product Name:** WalForm  
**Tagline:** Build forms. Store forever. Own your data.  
**Stack:** Next.js 15 · TypeScript · shadcn/ui · Sui Move · Walrus · Seal  
**Deploy Target:** Mainnet (bắt buộc theo yêu cầu hackathon)

---

## 2. Problem Statement

Hiện tại không có form/feedback platform nào trên Sui ecosystem:
- Lưu trữ decentralized (không phụ thuộc server trung tâm)
- Cho phép mã hóa data nhạy cảm với access control on-chain
- Tồn tại vĩnh viễn trên Walrus blob storage

WalForm giải quyết đúng 3 pain point này, và đồng thời là tool Walrus team sẽ dùng thực tế.

---

## 3. User Roles

| Role | Mô tả |
|------|--------|
| **Creator** | Tạo form, xem submissions, quản lý dashboard |
| **Responder** | Fill form qua public link (không cần wallet) |
| **Admin** | Creator + khả năng grant access cho người khác xem data |

---

## 4. Functional Requirements

### 4.1 Form Builder (FR-01 → FR-07)

| ID | Requirement | Priority |
|----|------------|----------|
| FR-01 | Tạo form với title, description, category template | P0 |
| FR-02 | Thêm/xóa/sắp xếp các field: Text, Textarea, Dropdown, Checkbox, Rating (1-5 sao), URL, File Upload (ảnh/video/screenshot) | P0 |
| FR-03 | Đánh dấu field bắt buộc (required) | P0 |
| FR-04 | Preview form trước khi publish | P1 |
| FR-05 | Chọn sensitive fields → sẽ được Seal encrypt | P0 |
| FR-06 | Publish form → tạo Sui object + lưu config lên Walrus → nhận public link | P0 |
| FR-07 | Template sẵn: Bug Report · Feature Request · Job Application · Survey · Office Hours Feedback | P1 |

### 4.2 Form Submission (FR-08 → FR-12)

| ID | Requirement | Priority |
|----|------------|----------|
| FR-08 | Responder truy cập qua link dạng `/f/[formId]` | P0 |
| FR-09 | Fill form không cần wallet (gasless cho responder) | P0 |
| FR-10 | Upload file (ảnh, video, screenshot) lên Walrus trực tiếp từ browser | P0 |
| FR-11 | Sensitive fields được AES-GCM encrypt client-side trước khi upload | P0 |
| FR-12 | Sau submit: tạo Submission object trên Sui chứa blobId reference | P0 |

### 4.3 Dashboard (FR-13 → FR-19) — *Killer feature*

| ID | Requirement | Priority |
|----|------------|----------|
| FR-13 | List tất cả forms của creator (filter by status: active/closed) | P0 |
| FR-14 | Xem submissions theo từng form, sort by date/status | P0 |
| FR-15 | Click "Decrypt & View" → Seal decrypt on-demand, hiển thị sensitive fields | P0 |
| FR-16 | Label/tag submission (New · In Progress · Resolved · Spam) | P1 |
| FR-17 | Add private note trên từng submission | P1 |
| FR-18 | Export submissions as CSV / JSON | P1 |
| FR-19 | Stats overview: tổng responses, response rate, field completion rate | P2 |

### 4.4 Access Control (FR-20 → FR-22)

| ID | Requirement | Priority |
|----|------------|----------|
| FR-20 | Chỉ creator (owner của Form object) mới có thể xem dashboard | P0 |
| FR-21 | Creator có thể grant admin access cho địa chỉ khác | P2 |
| FR-22 | Seal policy: `seal_approve_creator_or_admin` | P0 |

---

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|------------|
| **Performance** | Upload progress bar cho file > 1MB |
| **UX** | Mobile responsive, form fill phải mượt trên mobile |
| **Security** | AES-GCM 256-bit cho sensitive fields, threshold = 2 Seal key servers |
| **Storage** | Walrus epochs = 12 (~1 tháng), deletable = false |
| **Deploy** | Sui Mainnet + Walrus Mainnet + Vercel |
| **Video Demo** | Quay bằng chính WalForm, upload lên Walrus qua WalForm |

---

## 6. Out of Scope (v1 Hackathon)

- Multi-language form
- Email notification khi có submission mới
- Collaboration real-time
- Form analytics chi tiết (heatmap, drop-off rate)
- Mobile app

---

## 7. Submission Checklist (Hackathon)

- [ ] Deploy Move package lên Mainnet → lưu packageId
- [ ] Deploy frontend lên Vercel với mainnet config
- [ ] Tạo ít nhất 1 form test
- [ ] Có ít nhất 1 submission test
- [ ] Quay video demo < 3 phút bằng WalForm
- [ ] Upload video lên Walrus qua WalForm
- [ ] Repo public + README rõ ràng
- [ ] Nộp bài tại DeepSurge với link repo + video blob
- [ ] Tag @WalrusProtocol + @walgo_xyz khi post
