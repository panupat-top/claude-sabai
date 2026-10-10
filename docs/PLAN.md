# claude-sabai — Plan

> สถานะ (2026-10-10): Phase 3 — C2 agents panel + skins panel + toolbar + ปุ่มคำสั่ง + รูปแบบ bar + agents pane รอบ 2 เสร็จ (`sabai-band` 0.8.0)
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
| Toolbar | ซ้าย: `/context` `/usage` `/review` `/compact` `/rewind` `/resume` `/clear` (เฉพาะที่ surface มี, `$.command.list`) · ขวา: ปุ่ม icon: `✻` Agents (+จำนวน agent ที่ทำงาน) · `⚙` Skins · hotkey `a` / `s` เมื่อ band ถูก focus | ปุ่ม native ของ desktop — skin เปลี่ยนได้แค่สีสัญลักษณ์ |

- **Agents panel (C2, รอบ 2):** การ์ดสรุป (Agents · Context · Time) · การ์ด agent: Clawd ใส่หมวกตามชนิด (Explore/Plan/general/guide/อื่นๆ) สีตาม skin, ป้าย effort (quick/steady/careful/deep), ความคืบหน้าของ task ของ agent เอง (`3/5 · ชื่อขั้น`) หรือจำนวน step, ctx, เวลา · เดินเมื่อทำงาน กระโดดเมื่อเสร็จ หลับตาเมื่อล้มเหลว · กลุ่ม Finished พับไว้ (Show/Hide), Clear, Result ต่อ agent (สรุปผลหรือเหตุผลที่ล้มเหลว) · task ของ subagent แยกจาก band · sprite รวม pixel run (Clawd ~2k) และแสดง Finished 8 ตัวล่าสุด ให้ pane ไม่เกิน 100k
- **Skin:** `/sabai-skin` เปิด/ปิด pane เลือก skin (ชื่อ skin ชิดซ้าย ปุ่ม Use ชิดขวา + ตัวอย่างสีของ skin นั้น, กดแล้วเปลี่ยนทันที) · `/sabai-skin <name>` — `auto` (ตาม OS) + Catppuccin Latte / Frappé / Macchiato / Mocha, Dracula, Tokyo Night, Nord, Gruvbox Dark, Rosé Pine · จำใน `$.store` · เปลี่ยนการ์ด, ชิป, ราง bar, ตัวอักษร, สี meter, เตือน/แดง, progress bar, pill, Clawd และสีใน terminal · สีตัวอักษรที่ไม่ถึง 4.5:1 ถูกปรับเฉด (`readable`) · ไม่มีพื้นหลัง band (วางบนพื้นของแอปเหมือน `auto`) · การ์ดใช้ชั้นที่สว่างกว่าของ theme (`cardOf`)
- **Progress bar (A2):** กลุ่มที่สองของ pane Skins (ต่อจาก Color theme) เลือกรูปแบบ bar — Dither / Pixel blocks / Solid แต่ละแบบมีตัวอย่างและปุ่ม Use · จำใน `$.store` · มีผลกับ band บน desktop (terminal ยังใช้ตัวอักษรเดิม)
- **รอบการอ่าน:** countdown และ branch ทุก 30 วิ · `git status` + ahead/behind เฉพาะตอนเริ่ม session, จบ turn และเมื่อ branch เปลี่ยน
- **ใช้ได้ทุกเครื่อง:** ไม่อ่านไฟล์ภายนอก ไม่แตะ credential ข้อมูลที่หาไม่ได้จะถูกซ่อน

## 2. การตัดสินใจ

| เรื่อง | เลือก | เหตุผล |
|---|---|---|
| โครงสร้าง | marketplace `claude-sabai`, mod ละโฟลเดอร์ใน `plugins/` | เปิด/ปิดทีละตัว |
| Surface หลัก | desktop Code tab | terminal ใช้ข้อความแทน SVG |
| ภาษา | อังกฤษอย่างเดียว | ตัด i18n ออกพร้อม `sabai-spinner` |
| 7D <model> | ตัดทิ้ง | engine ไม่มีค่านี้ ทางเดียวคือให้ mod อ่าน OAuth token เอง |
| ปุ่ม / status line | toolbar ใต้ band (แบบ A) · ไม่มี status line | เดิมตัดปุ่มออก ตอนนี้เพิ่มกลับเฉพาะเรียก feature · `$.ui.status` ไม่แสดงใน Code tab |
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
| D2 | แจ้งเตือนเมื่อ turn ยาวจบ (toast + เสียง) | S | |
| D1 | Guard คำสั่งอันตราย (`rm -rf /`, `git push --force` ไป main, อ่าน `.env`) | S | `tool.call` → `{ deny }` |
| C1 | File tree pane | L | filetree ทำไว้แล้ว |
| S-A | Customize: คู่ skin สว่าง/มืด, มุม, พื้นหลัง, density, animation | S–M | ต่อจาก A2 |
| S-B | เลือกส่วนที่แสดง: การ์ด, info row, Clawd, ปุ่มคำสั่ง, เกณฑ์เตือน | M | |
| S-C | Custom skin (hex), export/import JSON, skin ต่อ project | L | |
| A1–A4 | ธีมทั้ง transcript | L | เสี่ยงพังเมื่อ Claude Code อัปเดต — ไม่แนะนำ |
