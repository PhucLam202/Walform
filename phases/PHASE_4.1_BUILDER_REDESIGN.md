# Phase 4.1 — Form Builder Redesign (Pro Version)

> **Mục tiêu:** Nâng cấp UI/UX của Form Builder từ "MVP" lên "Pro" với thiết kế minimalist, chuyên nghiệp và đầy đủ tính năng.
> **Ưu tiên:** 10 tính năng cốt lõi giúp cải thiện trải nghiệm người dùng.

## 1. Tính năng cần bổ sung (Theo thứ tự ưu tiên)

1. **Drag & Drop + Reorder (Trung bình)**
   - Sử dụng `@dnd-kit/core` và `@dnd-kit/sortable` để kéo thả và sắp xếp các field trên Canvas.
   - Hiện tại chỉ click để add, kéo thả giúp người dùng thao tác trực quan hơn giống Typeform/Tally.

2. **Field Properties Panel (Dễ)**
   - Click vào field trên canvas → hiện panel bên phải để chỉnh sửa: Label, Placeholder, Required, Help text, Options (cho dropdown/checkbox), Validation…
   - Giao diện: Tab "Properties" trên Right Sidebar.

3. **Inline editing trên Canvas (Dễ)**
   - Cho phép click trực tiếp vào label hoặc input trên canvas để sửa text ngay lập tức, không cần phải lúc nào cũng mở properties panel.

4. **Cải thiện Empty State (Rất dễ)**
   - Thêm illustration đẹp mắt + button “Add your first field” nổi bật.
   - Thêm phần gợi ý “Try a template below” để tăng tỉ lệ tương tác.

5. **Live Preview realtime + Responsive toggle (Trung bình)**
   - Right sidebar sẽ có tab "Preview".
   - Form trong preview có thể tương tác (điền thử).
   - Có nút toggle hiển thị Desktop / Mobile / Tablet.

6. **Top bar nâng cấp (Dễ)**
   - Auto-save indicator (vd: “Đã lưu lúc 08:12”).
   - Nút Undo / Redo.
   - Nút “Preview in new tab”.
   - Nút “Share draft” (tạo bản draft nháp để share link xem trước).

7. **Template thumbnails đẹp hơn (Dễ)**
   - Hiển thị dưới dạng card nhỏ có preview form mini thay vì chỉ là text list.

8. **Field badge (Rất dễ)**
   - Mỗi field trên canvas hiển thị badge nhỏ góc trên: ★ Required, 🔒 Encrypted, 📁 File, 💼 Wallet...

9. **Keyboard shortcut hint (Dễ)**
   - Thêm tooltip/hint nhỏ ở góc: “Press / to search fields” hoặc “Cmd+K” để add field nhanh.

10. **Dark mode toggle (Dễ)**
    - Phù hợp với UI của Sui/Walrus (thường dùng dark theme).

## 2. Gợi ý Layout mới (3 Cột)

### 2.1. Left Sidebar (Palette)
- **Top:** Search bar (tìm nhanh loại field).
- **Body:** Grid/List các field types.
- Có thể chia nhóm (Basic, Layout, Advanced, Sui-specific).

### 2.2. Center Canvas (Main Workspace)
- **Khi trống:** Empty state đẹp với illustration và nút gợi ý Template.
- **Khi có field:** 
  - Danh sách field dạng block.
  - Bên trái mỗi block có `drag handle` (≡).
  - Hover/Active block sẽ hiện 3 icon nhỏ góc trên: ✏️ (Edit), ★ (Required toggle), 🗑️ (Delete).
  - Nhấp chuột trực tiếp vào text để *Inline Edit*.

### 2.3. Right Sidebar (Properties & Preview)
- **Header:** 2 Tabs: `Preview` và `Properties`.
- **Tab Properties:**
  - Chỉ hiện khi có một field được chọn trên Canvas.
  - Các ô input setting (Label, placeholder, logic, validations).
- **Tab Preview:**
  - Realtime render form thật.
  - Header nhỏ chứa 3 icon toggle view: Desktop | Mobile | Tablet.

## 3. Các thư viện / Công nghệ cần dùng
- **Kéo thả:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **Icon:** `lucide-react`
- **UI Components:** Shadcn UI (Tabs, Tooltip, Switch, Badge, ScrollArea, Dialog, v.v.)

## 4. Kế hoạch triển khai (Step-by-step)
- **Bước 1:** Cập nhật Layout 3 cột (Left Palette, Center Canvas, Right Sidebar) và Top bar mới.
- **Bước 2:** Cài đặt và tích hợp `dnd-kit` vào Center Canvas.
- **Bước 3:** Xây dựng Right Sidebar với 2 tabs (Preview và Properties), kết nối với `useBuilderStore`.
- **Bước 4:** Bổ sung Inline Editing trên Center Canvas và các field badge.
- **Bước 5:** Thêm Empty State, Template Thumbnails, Dark mode toggle và keyboard shortcuts.
