# Hướng Dẫn Cơ Chế Dự Phòng (Fallback) và Khôi Phục (Recovery) Đồng Bộ

Tài liệu này cung cấp sơ đồ, thời gian cấu hình và chi tiết hoạt động của cơ chế dự phòng đồng bộ cho toàn bộ các kênh WebSocket (`ASR Transcript`, `Audio Micro`, `SetLanguage`, `Translation`, `Chatbot`) trên Frontend khi gặp sự cố kết nối Local.

---

## 1. Sơ Đồ Tuần Tự (Sequence Diagram - Luồng Chuyển Đổi Dự Phòng)

Sơ đồ này minh họa cách hệ thống tự động phát hiện sự cố từ cổng Local ASR, chuyển đổi đồng bộ toàn bộ các kênh kết nối khác sang Cloud AI Server sử dụng chung một `session_id`, và khôi phục khi phát hiện Local hoạt động trở lại:

```mermaid
sequenceDiagram
    autonumber
    participant Client as Frontend (Browser)
    participant Local as Local Services (127.0.0.1:9001)
    participant Cloud as Cloud AI Server (bkmeeting.soict.io/serverai)

    Note over Client,Local: Giai đoạn 1: Khởi chạy ở chế độ LOCAL (Bình thường)
    Client->>Local: Kết nối /transcript (ASR)
    Client->>Local: Kết nối /setlanguage (Thiết lập ngôn ngữ)
    Client->>Local: Kết nối /translation (Dịch thuật)
    Client->>Local: Kết nối /chatbot (Hỏi đáp AI)
    Local-->>Client: Hoạt động bình thường ở chế độ Local

    Note over Client,Local: Giai đoạn 2: Phát hiện lỗi & Kích hoạt Fallback
    Local -x Client: Mất kết nối (Mất mạng, tắt service local)
    Note over Client: Trigger fallback: isTranscriptFallback = true<br/>Sinh ngẫu nhiên transcriptSessionId duy nhất (UUID)
    Client->>Client: Đóng toàn bộ các kết nối Local cũ

    Note over Client,Cloud: Giai đoạn 3: Chuyển đổi đồng bộ sang CLOUD
    Client->>Cloud: Kết nối /transcript?session_id={sessionId}
    Client->>Cloud: Kết nối /audio?session_id={sessionId}
    Client->>Cloud: Kết nối /setlanguage?session_id={sessionId}
    Client->>Cloud: Kết nối /translation?session_id={sessionId}
    Client->>Cloud: Kết nối /chatbot?session_id={sessionId}
    Cloud-->>Client: Hoạt động ổn định trên Cloud với cùng Session ID

    Note over Client,Local: Giai đoạn 4: Thăm dò (Probe) để khôi phục LOCAL
    loop Định kỳ mỗi 60 giây
        Client->>Local: Gửi kết nối thăm dò (Probe) tới /transcript (Timeout: 3 giây)
        alt Thăm dò thất bại (Local chưa sẵn sàng)
            Local--x Client: Không phản hồi hoặc lỗi
            Note over Client: Duy trì hoạt động trên Cloud AI
        else Thăm dò thành công (Local đã hoạt động lại)
            Local-->>Client: Kết nối Open thành công!
            Client->>Client: Đặt isTranscriptFallback = false
            Client->>Client: Đóng toàn bộ kết nối Cloud AI
            Client->>Local: Khởi động lại luồng kết nối LOCAL (như Giai đoạn 1)
        end
    end
```

---

## 2. Sơ Đồ Luồng Quyết Định (Flowchart - SetLanguage & Translation)

Sơ đồ luồng logic dưới đây mô tả cách hệ thống đồng bộ danh sách ngôn ngữ dịch thuật (`setlanguage`) và tiếp nhận phụ đề dịch (`translation`) trong cả hai chế độ:

```mermaid
flowchart TD
    %% Định nghĩa các Style màu sắc
    classDef startEnd fill:#f9f,stroke:#333,stroke-width:2px;
    classDef process fill:#bbf,stroke:#333,stroke-width:1px;
    classDef decision fill:#ff9,stroke:#333,stroke-width:1px;
    classDef fallback fill:#fbb,stroke:#333,stroke-width:1px;

    Start([1. Người dùng vào phòng họp]) --> InitLocal[2. Mở kết nối WebSocket LOCAL<br/>- setlanguage<br/>- translation]
    InitLocal --> SyncLang[3. Đồng bộ Ngôn ngữ: syncLanguages]
    
    %% Luồng Đồng bộ ngôn ngữ
    SyncLang --> GetList[Lấy ds thành viên LiveKit]
    GetList --> LookupAPI[Gọi API lookupLanguages]
    LookupAPI --> MakePayload[Tạo gói tin cấu hình:<br/>myLang & destLanguages]
    MakePayload --> SendLocal[Gửi cấu hình qua WS setlanguage]
    SendLocal --> CachePayload[Lưu cấu hình vào lastPayload]

    %% Giám sát trạng thái lỗi
    CachePayload --> Monitor{Kết nối Local ASR hoạt động?}
    
    %% Nhánh bình thường
    Monitor -- Có (Bình thường) --> NormalWork[Hoạt động bình thường:<br/>- setlanguage: gửi cấu hình khi có người mới<br/>- translation: nhận phụ đề dịch thời gian thực]
    NormalWork --> Monitor

    %% Nhánh xảy ra sự cố (Fallback)
    Monitor -- Không (Lỗi kết nối) --> TriggerFallback[4. Kích hoạt Fallback sang CLOUD<br/>- Sinh sessionId mới<br/>- Đặt isTranscriptFallback = true]
    
    TriggerFallback --> CloseLocal[Đóng kết nối LOCAL cũ]
    CloseLocal --> InitCloud[5. Mở kết nối WebSocket CLOUD<br/>- setlanguage?session_id<br/>- translation?session_id]
    
    %% Tự động gửi lại cấu hình
    InitCloud --> AutoSendCache[Tự động gửi lại lastPayload<br/>qua WS setlanguage Cloud]
    
    AutoSendCache --> CloudWork[Hoạt động chế độ Cloud AI:<br/>Dữ liệu được đồng bộ bằng sessionId]

    %% Luồng tuần tra khôi phục (Recovery)
    CloudWork --> ProbeLoop{Định kỳ mỗi 60 giây:<br/>Probe thử Local ASR?}
    
    ProbeLoop -- Thất bại --> CloudWork
    
    ProbeLoop -- Thành công (Local hoạt động lại) --> Recovery[6. Khôi phục về LOCAL<br/>- Đặt isTranscriptFallback = false<br/>- Đóng toàn bộ kết nối CLOUD]
    Recovery --> InitLocal
```

---

## 3. Các Mốc Thời Gian Cấu Hình (Timings & Delays)

| Tên Hoạt Động | Thời Gian Chờ (Delay / Interval) | Cơ Chế Xử Lý | Vị Trí Cấu Hình trong Code |
| :--- | :--- | :--- | :--- |
| **Kích hoạt Fallback** | **Tức thì (~10ms - 100ms)** | Kích hoạt ngay khi nhận tín hiệu lỗi kết nối Local lần đầu tiên | `TranscriptRoomProvider.tsx` |
| **Thời gian bắt tay kết nối Cloud** | **~200ms - 600ms** | Bao gồm DNS, TCP handshake, TLS/SSL handshake và WS Upgrade | Trình duyệt xử lý |
| **Độ trễ đóng gói âm thanh** | **256ms** | Chờ thu âm đủ 4096 mẫu ở tần số 16kHz để đóng gói gửi đi | `physicalMicWebSocket.ts` |
| **Thử kết nối lại ASR Local** | **2.8 giây** (2800 ms) | Thử lại liên tục khi mất kết nối ở chế độ Local | `TranscriptRoomProvider.tsx` |
| **Thử kết nối lại Dịch thuật (Translation)** | **3.0 giây** (3000 ms) | Thử lại liên tục khi mất kết nối | `translationWebSocket.ts` |
| **Thử kết nối lại Thiết lập ngôn ngữ (SetLanguage)** | **3.0 giây** (3000 ms) | Thử lại liên tục khi mất kết nối | `translationLanguageWebSocket.ts` |
| **Thử kết nối lại Chatbot AI** | **Tăng dần từ 0.8s tới tối đa 5s** | Linear Backoff: `Min(5000, 800 * số_lần_thử)` | `chatboxWebSocket.ts` |
| **Khoảng thời gian Thăm dò Local** | **60 giây** (1 phút) | Định kỳ thăm dò xem ASR local hoạt động lại chưa | `page.tsx` |
| **Thời gian chờ Thăm dò (Probe Timeout)** | **3.0 giây** (3000 ms) | Tự động hủy kết nối Probe nếu không phản hồi | `page.tsx` |

---

## 4. Chi Tiết Hoạt Động Của Dịch Vụ

### A. Cơ chế đồng bộ qua Session ID duy nhất
Khi chạy ở chế độ Cloud AI, máy chủ cần biết gói dữ liệu âm thanh của micro nào đi kèm với phụ đề dịch thuật và chatbot nào của cùng một phiên làm việc.
- Mã `transcriptSessionId` được sinh ngẫu nhiên (UUID) ngay khi kích hoạt dự phòng.
- Mã này được gắn vào tất cả các URL WebSocket dưới dạng query parameter: `?session_id={transcriptSessionId}`.

### B. Cơ chế lưu cache cấu hình ngôn ngữ (`lastPayload`)
- Khi chuyển đổi kết nối, WebSocket `/setlanguage` cũ bị ngắt và tạo mới.
- Hệ thống tự động cache lại gói tin gửi đi gần nhất:
  ```json
  {
    "source_language": "vi",
    "destination_languages": ["en", "ja"]
  }
  ```
- Ngay khi WebSocket mới mở trạng thái `OPEN`, hệ thống tự gửi lại gói tin từ cache này để giữ nguyên cài đặt dịch thuật mà không làm phiền người dùng.

---

## 5. Mẫu JSON Gửi và Nhận (Payload Schemas)

### A. Dịch vụ Đặt Ngôn Ngữ (`setlanguage`)

- **Nhận từ Server (khi vừa kết nối thành công)**:
  ```json
  {
    "type": "ready",
    "stream": "setlanguage",
    "session_id": "aa473211-28f9-421a-a8d9-59ba924c56fc",
    "source_language": "vi",
    "destination_languages": [],
    "version": 0,
    "enabled": false
  }
  ```

- **Gửi xuống Server (để cấu hình)**:
  ```json
  {
    "source_language": "vi",
    "destination_languages": ["en"]
  }
  ```

- **Nhận từ Server (phản hồi cấu hình thành công)**:
  ```json
  {
    "type": "language_set",
    "session_id": "aa473211-28f9-421a-a8d9-59ba924c56fc",
    "source_language": "vi",
    "destination_languages": ["en"],
    "version": 1,
    "enabled": true
  }
  ```

### B. Dịch vụ Nhận Dịch Thuật (`translation`)

- **Nhận từ Server (khi vừa kết nối thành công)**:
  ```json
  {
    "type": "ready",
    "stream": "translation",
    "session_id": "aa473211-28f9-421a-a8d9-59ba924c56fc"
  }
  ```

- **Nhận từ Server (tín hiệu giữ kết nối định kỳ)**:
  ```json
  {
    "type": "keepalive"
  }
  ```

- **Nhận từ Server (Bản dịch thời gian thực)**:
  Khi một người phát biểu kết thúc câu, máy chủ AI dịch sang các ngôn ngữ đích được yêu cầu và gửi về:
  ```json
  {
    "en": "Hello everyone. How are you doing today?",
    "ja": "皆さん、こんにちは。今日の調子はいかがですか？"
  }
  ```
