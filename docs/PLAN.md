# claude-sabai — Plan

> สถานะ (2026-10-11): `sabai-band` **1.1.0**: เพิ่มส่วน Chat (บรรทัดสรุปใต้ tool, ผล test, callout, spinner ภาษาไทย, ป้าย guard) ต่อจาก 1.0.0
> อ้างอิง (MIT ทั้งหมด): [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) ·
> [JohnnyVizz/claude-kit › savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) ·
> [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree)

## 1. สิ่งที่มีตอนนี้: `sabai-band`

band เหนือช่องพิมพ์ สไตล์ pixel แบบ savvy-progress วาดเป็น SVG ชิ้นเดียวบน desktop และเป็นข้อความบน terminal ทุกแถวซ่อนได้ใน Settings

| แถว | แสดง | ที่มาของข้อมูล |
|---|---|---|
| Info | ซ้าย: 📁 directory · Git user · ⎇ branch `↑ ↓ ±` — ขวา: Node | `git`, `node` ผ่าน `$.process.run` (timeout 5 วิ, ไม่รอตอนเริ่ม) · ตาม folder เมื่อ session ย้าย (`$.session.cwd`) · หาไม่ได้ = ซ่อน |
| Tasks | Clawd · bar (dither/blocks/solid) · pill `n/total` · % · ตัวหนังสือสีตาม OS | `TaskCreate` / `TaskUpdate` / `TodoWrite` ของบทสนทนาหลัก |
| Crew | Clawd ตัวเล็กตาม agent ที่ทำงาน (จำนวนตามความกว้าง) ใส่หมวก/ถือของ · งานล่าสุด · ● ✓ ✗ · เวลา · หายเองหลังตัวสุดท้ายจบ 1 นาที | `agent.spawn` / `turn.step` / `turn.complete` |
| Usage | การ์ด Context · 5H · 7D All พร้อม countdown · เตือน 70% / แดง 90% | `session.usage`, `session.measure` |
| Toolbar | `/review` `/compact` `/rewind` `/resume` (เฉพาะที่ surface มี) · `✻` Agents · `⚙` Settings | `$.command.list`, `$.command.run` |

- **Agents panel:** แถบสรุป · การ์ดต่อ agent: ชื่องานพร้อม emoji ประจำชนิด + ปุ่ม **Report** · Clawd ใส่หมวกและถือของตามชนิด (8 ชนิด + agent จาก plugin `x:y`) · effort `low…max` / `budget 32k` · `workflow` · ความคืบหน้า (tool `step` ของ mod ก่อน แล้วจึง task list) · ไอคอนสถานะมี animation · กลุ่ม Finished พับได้, Clear, รายงาน Markdown ทีละฉบับ · จำนวนการ์ดคุมด้วยขนาดจริง (`PANE_BUDGET`) ให้ tree ไม่เกิน 100k · agent remote ที่ไม่มี loop ไม่สร้างการ์ด
- **Settings panel** (`/sabai-settings`, `⚙`): Band (ซ่อน/แสดง 5 แถว) · Progress bar (3 ปุ่ม + ตัวอย่าง) · Alerts (แจ้งเตือน turn ≥ 1 นาที/agent ล้มเหลวผ่าน `$.ui.notify`, toast เมื่อ 5H/7D ≥ 90% ครั้งเดียวต่อรอบ) · Agents and safety (Step reports = tool `mcp__sabai-band__step`, Guard ปิดไว้ก่อน = `tool.call` Bash/Read → `{ deny }`) · Color theme 10 แบบ · ทุกค่าเก็บใน `$.store` (`prefs`, `skin`, `bar`)
- **Chat** (กลุ่มใน Settings, เปิดปิดทีละข้อ): แถว Edit/Write/Read/Bash วาดเป็น step บรรทัดเดียวแบบ minimal (icon เส้น · หัวข้อ · รายละเอียด · meter · pill ผลลัพธ์ · เวลา ⚡/🐢) · ผล test ของ bun/jest/vitest/pytest/cargo/go · callout `> [!NOTE]` เป็นกล่อง + บอก Claude 1 บรรทัดใน system prompt · spinner ภาษาไทย · ป้าย guard (icon โล่แบบเส้น) ใต้ช่องพิมพ์ · สีในหน้า chat ใช้ theme key ของผู้ใช้
- **ใช้ได้ทุกเครื่อง:** ไม่อ่านไฟล์ภายนอก ไม่แตะ credential ข้อมูลที่หาไม่ได้จะถูกซ่อน

## 2. การตัดสินใจ

| เรื่อง | เลือก | เหตุผล |
|---|---|---|
| โครงสร้าง | marketplace `claude-sabai`, mod ละโฟลเดอร์ใน `plugins/` | เปิด/ปิดทีละตัว |
| Surface หลัก | desktop Code tab | terminal ใช้ข้อความแทน SVG |
| ภาษา | อังกฤษอย่างเดียว | ตัด i18n ออกพร้อม `sabai-spinner` |
| 7D <model> | ตัดทิ้ง | engine ไม่มีค่านี้ ทางเดียวคือให้ mod อ่าน OAuth token เอง |
| ปุ่ม / status line | toolbar ใต้ band (แบบ A) · ไม่มี status line | เดิมตัดปุ่มออก ตอนนี้เพิ่มกลับเฉพาะเรียก feature · `$.ui.status` ไม่แสดงใน Code tab |
| ตั้งค่า | pane Settings + slash command | `/config` ใช้ใน Code tab ไม่ได้ |

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
| C1 | File tree pane | L | filetree ทำไว้แล้ว |
| S-A | Customize: คู่ skin สว่าง/มืด, มุม, พื้นหลัง, density, animation | S–M | ต่อจาก A2 |
| S-B | (บางส่วนเสร็จ: ซ่อน/แสดงแถว) เลือกการ์ด usage ทีละใบ, เกณฑ์เตือน | S | |
| S-C | Custom skin (hex), export/import JSON, skin ต่อ project | L | |
| A1–A4 | ธีมทั้ง transcript | L | เสี่ยงพังเมื่อ Claude Code อัปเดต — ไม่แนะนำ |
