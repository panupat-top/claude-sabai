# claude-sabai — Plan

> สถานะ (2026-10-11): 2.4.3 ปิด M25: หัว race/tiles/การ์ด agent/เวลาใน step ไม่ทับกัน, วัดความกว้าง emoji และ CJK ถูก, ตัด note ไม่กลาง emoji, receipt ของคำตอบซ้ำไปอยู่ใน notice, `/clear` ล้าง state ของ turn ครบ, เตือน limit ไม่ซ้ำหลัง reload, band ไม่ใช้นาฬิกาปี 1970, Write นับตาม diff, test ที่อ่านผลไม่ได้ล้างผลเก่า, call ขนานไม่ชนกันใน race, guard จับ `checkout ./`/`-f`, `switch -f` และ heredoc ที่ pipe เข้า shell · 2.4.2 ไม่แสดงเวลาของ turn ที่เริ่มก่อน sabai โหลด (เดิมนับจากปี 1970), guard อ่านคำสั่งทีละคำ (ทุก rm ทุก target, flag ยาว, quote, `FOO=1 git …`, `bash -c`, .env ที่อ่านจริง), guard ปฏิเสธเมื่อตรวจไม่ได้ใน tool.check, เวลา turn เดินต่อหลัง reload กลาง turn, จุด dither เป็น path เดียวต่อ class (band จอกว้างไม่เกิน limit 100k) · 2.4.1 แก้แถว info: ชื่อ branch ไม่ค้างสภาพถูกตัดเมื่อ guard หาย, โล่ไม่มีข้อความว่าง, วัดความกว้าง emoji ถูก, ไม่ตัด emoji ที่ต่อกันกลางตัว · 2.4.0 แถว info แบบใหม่ บรรทัดเดียว minimal (ชื่อโปรเจกต์ · ป้าย branch + sync · guard, Node, git user สีจาง) · 2.3.0 Clawd บอกอารมณ์พร้อมเหตุผล + ลูกเล่น (โบกมือ หาว มองกล่อง race/limit), usage เต็มความสูง band เลือกได้ 4 แบบ (Tiles/Rings/Columns/Rows) และเอาค่าคาดการณ์ออก, กล่อง race ตัดตัวนับเกมออก ตั้งชื่อ lane ตามงาน รวม agent ชนิดเดียวกัน, settings จัดกลุ่มใหม่ + Reset · 2.2.0 band แบบ 3 แผง (Clawd · info/usage · race เกมวิ่งของ Main และ agent), คาดการณ์ 5H/7D, เลือกสิ่งที่แสดงใน band, density compact, Clawd ตามเวลา/เทศกาล · 2.1.0 เพิ่ม turn receipt, guard แบบเลือก Block/Ask/Off ทีละ rule (+ rule discard) และอารมณ์ของ Clawd · guard ล้มแบบปิด · 2.0.0 เปลี่ยนชื่อ mod จาก `sabai-band` เป็น **`sabai`** เพราะครอบคลุมมากกว่า band แล้ว · 1.1.0 เพิ่มส่วน Chat (step ของ tool, ผล test, callout, spinner ภาษาไทย, โล่ guard ใน band)
> อ้างอิง (MIT ทั้งหมด): [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) ·
> [JohnnyVizz/claude-kit › savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) ·
> [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree)

## 1. สิ่งที่มีตอนนี้: `sabai`

band เหนือช่องพิมพ์ สไตล์ pixel แบบ savvy-progress วาดเป็น SVG ชิ้นเดียวบน desktop และเป็นข้อความบน terminal ทุกแถวซ่อนได้ใน Settings

| แถว | แสดง | ที่มาของข้อมูล |
|---|---|---|
| Info | ซ้าย: 📁 directory · Git user · ⎇ branch `↑ ↓ ±` — ขวา: Node | `git`, `node` ผ่าน `$.process.run` (timeout 5 วิ, ไม่รอตอนเริ่ม) · ตาม folder เมื่อ session ย้าย (`$.session.cwd`) · หาไม่ได้ = ซ่อน |
| Tasks | Clawd · bar (dither/blocks/solid) · pill `n/total` · % · ตัวหนังสือสีตาม OS | `TaskCreate` / `TaskUpdate` / `TodoWrite` ของบทสนทนาหลัก |
| Crew | Clawd ตัวเล็กตาม agent ที่ทำงาน (จำนวนตามความกว้าง) ใส่หมวก/ถือของ · งานล่าสุด · ● ✓ ✗ · เวลา · หายเองหลังตัวสุดท้ายจบ 1 นาที | `agent.spawn` / `turn.step` / `turn.complete` |
| Usage | การ์ด Context · 5H · 7D All พร้อม countdown · เตือน 70% / แดง 90% | `session.usage`, `session.measure` |
| Toolbar | `/review` `/compact` `/rewind` `/resume` (เฉพาะที่ surface มี) · `✻` Agents · `⚙` Settings | `$.command.list`, `$.command.run` |

- **Agents panel:** แถบสรุป · การ์ดต่อ agent: ชื่องานพร้อม emoji ประจำชนิด + ปุ่ม **Report** · Clawd ใส่หมวกและถือของตามชนิด (8 ชนิด + agent จาก plugin `x:y`) · effort `low…max` / `budget 32k` · `workflow` · ความคืบหน้า (tool `step` ของ mod ก่อน แล้วจึง task list) · ไอคอนสถานะมี animation · กลุ่ม Finished พับได้, Clear, รายงาน Markdown ทีละฉบับ · จำนวนการ์ดคุมด้วยขนาดจริง (`PANE_BUDGET`) ให้ tree ไม่เกิน 100k · agent remote ที่ไม่มี loop ไม่สร้างการ์ด
- **Settings panel** (`/sabai-settings`, `⚙`): Band (ซ่อน/แสดง 5 แถว) · Progress bar (3 ปุ่ม + ตัวอย่าง) · Alerts (แจ้งเตือน turn ≥ 1 นาที/agent ล้มเหลวผ่าน `$.ui.notify`, toast เมื่อ 5H/7D ≥ 90% ครั้งเดียวต่อรอบ) · Agents and safety (Step reports = tool `mcp__sabai__step`, Guard ปิดไว้ก่อน: 4 rule เลือก Block = `tool.call` → `{ deny }` / Ask = `tool.check` → `{ decision: 'ask' }` / Off ได้ทีละ rule) · Color theme 10 แบบ · ทุกค่าเก็บใน `$.store` (`prefs`, `skin`, `bar`)
- **Chat** (กลุ่มใน Settings, เปิดปิดทีละข้อ): แถว Edit/Write/Read/Bash วาดเป็น step บรรทัดเดียวแบบ minimal (icon เส้น · หัวข้อ · รายละเอียด · meter · pill ผลลัพธ์ · เวลา ⚡/🐢) · ผล test ของ bun/jest/vitest/pytest/cargo/go · callout `> [!NOTE]` เป็นกล่อง + บอก Claude 1 บรรทัดใน system prompt · spinner ภาษาไทย · receipt ใต้คำตอบของ turn ที่ทำงาน (ไฟล์ที่แก้ · ผล test · command) · ป้าย guard เป็น chip โล่ในแถว Info ของ band พร้อมจำนวนที่กันได้ (desktop ไม่มีแถวป้ายโหมดใต้ช่องพิมพ์) · Clawd แสดงอารมณ์ (ตกใจ · เสียใจ · ฉลอง · เหงื่อตก · หลับ) · สีในหน้า chat ใช้ theme key ของผู้ใช้
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
| S-A | Customize: มุม, พื้นหลัง, animation | S–M | density เสร็จใน 2.2 · คู่ skin สว่าง/มืดตัดออก |
| S-B | ~~เลือกการ์ด usage ทีละใบ, เกณฑ์เตือน~~ | S | เสร็จใน 2.2 |
| R1 | ปรับการแสดงผลของ lane ในกล่อง race | M | ต่อจาก 2.3 |
| R2 | Agent pane ให้สอดคล้องกับกล่อง race และแสดงข้อมูลมากขึ้น เพราะแยกเป็น pane ของตัวเองแล้ว (เช่น tile ของทุก call, เวลาและ token ต่อ agent, ไฟล์ที่แตะ, ผลลัพธ์) | M–L | |
| R3 | Live strip: ต่อยอดการทำงานและการแสดงผล | M | |
| U1 | ปรับปรุงสไตล์ usage แต่ละแบบ (Tiles, Rings, Columns, Rows) ให้เหมาะกับ comfortable และ compact | M | 2.3 ทำแบบ comfortable ก่อน · compact ยังใช้การ์ดบรรทัดเดียว |
| K1 | Clawd redesign แบบมืออาชีพ ทีละตัว (sprite, ท่าทาง, ของประดับ) และเพิ่มตัวใหม่ในอนาคต | L | ทำเป็นรอบ ทีละตัว |
| M22 | Minor จาก final review ของ 2.2 | S | `isReadOnly` จัดบางคำสั่งผิด · terminal วาด Clawd สองตัว · `mainWorking` หายเมื่อ reload กลางเทิร์น · `race.calls` ไม่ถูกลบ · ~~out ยังไม่หลับตา, confetti วนทั้งนาที~~ (แก้ใน 2.3) · ~~หัวใจลดทุก call ที่ fail~~ (ตัดหัวใจออกใน 2.3) · `replace_all` นับ hunk · ~~ชื่อ lane ยาวทับ tiles~~ (ตัดด้วย fit ใน 2.3) · ~~README เรื่อง Live ปิดแล้ว race หาย~~ (2.3) · `textClass`/`fillColor` ไม่มีใครใช้ · call ขนานใช้ช่อง `doing` ร่วมกัน |
| M23 | Minor จาก final review ของ 2.3 | S | ring 0% มีจุด · ring ซ้อนแสดง `5H · ` เมื่อไม่มี reset · ปิด Activity แล้วไม่มีเวลาใต้ `working` · เครื่องหมายหาวดูเป็น I · look-up ตาเหลือ 1 px · `usageStyle in` รับ key ของ prototype · `}` เยื้องเกินใน register.tsx · settings pane ใช้ 97.8k จาก 100k · wave ไม่เคารพ reduced-motion |
| M24 | Minor จาก final review ของ 2.4 | S | ตัดชื่อ branch เหลือ 5 ตัว (spec 6) · band stacked 240 px ชื่อยาวล้น ~2 px · แถว info สูง 22 (chip เดิม 20) · ชื่อภาษา CJK กว้างกว่าที่ประเมิน · Node ไม่มี v ขึ้นเป็น "24" · คำว่า chip ค้างใน svg.ts/README · padding ขวาของป้าย 9 px · chips() ตัด undefined แบบยาว |
| M25 | ~~Minor จากการไล่บั๊ก 2.4.2~~ | M | เสร็จใน 2.4.3 · เหลือโดยตั้งใจ: wink ของ Clawd ยังวน 3.2s (ถ้าวนทุกวินาทีจะกะพริบถี่เกิน; จุดที่วาดใหม่ทุกวินาทีแค่ไม่กะพริบ) · Grep tool ไม่มีใน engine รุ่นนี้ จึงไม่มีช่องให้ปิด (`grep`/`rg` ใน shell จับอยู่แล้ว) · lane ที่ merge เรียง tile ทีละ agent เพราะ call ไม่มีเวลาให้เรียงสลับกัน |
| S-C | Custom skin (hex), export/import JSON, skin ต่อ project | L | |
| A1–A4 | ธีมทั้ง transcript | L | เสี่ยงพังเมื่อ Claude Code อัปเดต — ไม่แนะนำ |
