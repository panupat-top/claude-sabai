# claude-sabai — Plan

> สถานะ (2026-10-10): Phase 2 เสร็จ — มี mod เดียวคือ `sabai-band` · ถัดไป Phase 3
> อ้างอิง (MIT ทั้งหมด): [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) ·
> [JohnnyVizz/claude-kit › savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) ·
> [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree)

## 1. สิ่งที่มีตอนนี้: `sabai-band`

band เหนือช่องพิมพ์ สไตล์ pixel แบบ savvy-progress วาดทั้งหมดเป็น SVG ชิ้นเดียวบน desktop และเป็นข้อความบน terminal

| แถว | แสดง | ที่มาของข้อมูล |
|---|---|---|
| ข้อมูล | ซ้าย: 📁 directory · Git user · ⎇ branch `↑ahead ↓behind ±uncommitted` — ขวา: Node version | `git`, `node` ผ่าน `$.process.run` · หาไม่ได้ = ซ่อนชิปนั้น |
| Task | Clawd (เดินเมื่อ turn ทำงาน, กะพริบตาเมื่อรอ) · dithered progress bar · pill `n/total` · % | `TaskCreate` / `TaskUpdate` / `TodoWrite` · ล้างเมื่อ `/clear`, resume, fork |
| Usage | การ์ด Context `434.5k / 1M (43%)` · 5H Limit · 7D All พร้อม `↻` countdown · เตือน 70% / แดง 90% | engine อย่างเดียว (`session.usage`, `session.measure`) · ยังไม่มีค่า = ซ่อน |

- **Skin:** `/sabai-skin [name]` — `auto` (ตาม OS) + Catppuccin Latte / Frappé / Macchiato / Mocha, Dracula, Tokyo Night, Nord, Gruvbox Dark, Rosé Pine · จำใน `$.store` · เปลี่ยนพื้นหลัง band, การ์ด, ชิป, ราง bar, ตัวอักษร, สี meter, เตือน/แดง, progress bar, pill, Clawd และสีใน terminal · สีตัวอักษรที่ไม่ถึง 4.5:1 ถูกปรับเฉด (`readable`)
- **รอบการอ่าน:** countdown และ branch ทุก 30 วิ · `git status` + ahead/behind เฉพาะตอนเริ่ม session, จบ turn และเมื่อ branch เปลี่ยน
- **ใช้ได้ทุกเครื่อง:** ไม่อ่านไฟล์ภายนอก ไม่แตะ credential ข้อมูลที่หาไม่ได้จะถูกซ่อน

## 2. การตัดสินใจ

| เรื่อง | เลือก | เหตุผล |
|---|---|---|
| โครงสร้าง | marketplace `claude-sabai`, mod ละโฟลเดอร์ใน `plugins/` | เปิด/ปิดทีละตัว |
| Surface หลัก | desktop Code tab | terminal ใช้ข้อความแทน SVG |
| ภาษา | อังกฤษอย่างเดียว | ตัด i18n ออกพร้อม `sabai-spinner` |
| 7D <model> | ตัดทิ้ง | engine ไม่มีค่านี้ ทางเดียวคือให้ mod อ่าน OAuth token เอง |
| ปุ่ม / status line | ไม่มี | ผู้ใช้ตัดปุ่มออก · `$.ui.status` ไม่แสดงใน Code tab |
| ตั้งค่า | slash command | `/config` ใช้ใน Code tab ไม่ได้ |

## 3. บทเรียนจาก engine (Claude Code 2.1.29x)

- `$` ส่งข้าม import ไม่ได้: helper ที่รับ `$` ต้องอยู่ในไฟล์เดียวกับ `register`
- ตาราง element ของ terminal มี `Svg` แต่วาดไม่ได้ ต้องแยกด้วย `e.surface`
- desktop วาด Svg เป็นรูปภาพ: element พี่น้องถูกตัดขึ้นบรรทัดใหม่ จึงวาดทั้ง band เป็น SVG เดียว · ไม่ส่ง `width` = ย่อ markup ที่กว้างกว่า slot ให้พอดี (ไม่ขยาย) จึงวาดกว้าง `bodyColumns × 8.25` ให้เต็มเสมอ · `Svg` ต้องกว้าง/สูง 1–4096 px
- `session.measure` มาเมื่อมี response ใหม่เท่านั้น ตอนโหลดต้องอ่าน `$.session.usage()` เอง
- งานที่เริ่มจาก press ถูกยกเลิกเมื่อ press จบ ต้องรันผ่าน `$.clock.after`
- `$.ui.status` ไม่แสดงใน Code tab · `/config` ใช้ไม่ได้ใน Code tab
- types ของ mod API ไม่มีใน npm และ `plugin test/validate` ไม่วางให้ — CI จึงตรวจ type ไม่ได้ ใช้ pre-commit ในเครื่องแทน

## 4. Backlog (Phase 3+)

| ID | Feature | ขนาด | หมายเหตุ |
|---|---|---|---|
| C2 | Agents panel: Clawd ต่อ subagent + model + ความคืบหน้า | M | ต่อยอด Clawd ได้ตรงที่สุด |
| D2 | แจ้งเตือนเมื่อ turn ยาวจบ (toast + เสียง) | S | |
| D1 | Guard คำสั่งอันตราย (`rm -rf /`, `git push --force` ไป main, อ่าน `.env`) | S | `tool.call` → `{ deny }` |
| C1 | File tree pane | L | filetree ทำไว้แล้ว |
| A1–A4 | ธีมทั้ง transcript | L | เสี่ยงพังเมื่อ Claude Code อัปเดต — ไม่แนะนำ |
