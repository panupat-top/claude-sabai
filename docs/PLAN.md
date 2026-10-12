# claude-sabai — Plan

> สถานะ (2026-10-12): sabai 2.10.1 ทำงานเฉพาะ desktop Code tab · hub 1.0.0 status line สำหรับ terminal · ประวัติทุกเวอร์ชันอยู่ใน §5
> อ้างอิง (MIT ทั้งหมด): [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) ·
> [JohnnyVizz/claude-kit › savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) ·
> [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree)

## 1. สิ่งที่มีตอนนี้: `sabai`

band เหนือช่องพิมพ์ สไตล์ pixel แบบ savvy-progress วาดเป็น SVG บน desktop Code tab เท่านั้น ทุกแถวซ่อนได้ใน Settings

| แถว | แสดง | ที่มาของข้อมูล |
|---|---|---|
| Info | แถวบนเหนือ band ชิดซ้ายทั้งหมด: ชื่อโปรเจกต์ · ป้าย branch `↑ ↓ ±` · git user · Node (เวอร์ชันเต็ม) | `git`, `node` ผ่าน `$.process.run` (timeout 5 วิ, ไม่รอตอนเริ่ม) · ตาม folder เมื่อ session ย้าย (`$.session.cwd`) · หาไม่ได้ = ซ่อน |
| Live | เวลาของ turn หลักและ step ล่าสุด ขณะทำงาน | `turn.start` / `turn.step` / `turn.complete` |
| Tasks | Clawd · bar (dither/blocks/solid) · pill `n/total` · % · ตัวหนังสือสีตาม OS | `TaskCreate` / `TaskUpdate` / `TodoWrite` ของบทสนทนาหลัก |
| Crew | Clawd ตัวเล็กตาม agent ที่ทำงาน (จำนวนตามความกว้าง) ใส่หมวก/ถือของ · งานล่าสุด · ● ✓ ✗ · เวลา · หายเองหลังตัวสุดท้ายจบ 1 นาที | `agent.spawn` / `turn.step` / `turn.complete` |
| Usage | Context · 5H · 7D All พร้อม countdown · 4 แบบ (Tiles/Rings/Columns/Rows, เฉพาะ comfortable) · เตือน/แดงตั้งได้ (ค่าเริ่มต้น 70% / 90%) | `session.usage`, `session.measure` |
| Race | กล่องขวาสุดของ band (comfortable, ≥ 760 px): lane ของ Main และ agent ละ lane, รอยเท้าเป็น icon ต่อ call | hook ของ Read/Edit/Write/Bash |
| Toolbar | icon Lucide ชิดขวาของแถวบน: Guard (เมื่อเปิด) · Compact (บอก % เมื่อถึง warnAt) · Agents (นับที่ทำงาน) · Settings · สีทีละ icon: Agents ตอนมี agent ทำงาน ไม่งั้น Compact | `$.command.list`, `$.command.run` |

- **Agents panel:** แถบสรุป · การ์ดต่อ agent: ชื่องานพร้อม emoji ประจำชนิด + ปุ่ม **Report** · Clawd ใส่หมวกและถือของตามชนิด (8 ชนิด + agent จาก plugin `x:y`) · effort `low…max` / `budget 32k` · `workflow` · ความคืบหน้า (tool `step` ของ mod ก่อน แล้วจึง task list) · ไอคอนสถานะมี animation · กลุ่ม Finished พับได้, Clear, รายงาน Markdown ทีละฉบับ · จำนวนการ์ดคุมด้วยขนาดจริง (`PANE_BUDGET`) ให้ tree ไม่เกิน 100k · agent remote ที่ไม่มี loop ไม่สร้างการ์ด
- **Settings panel** (`/sabai-settings`, `⚙`): Layout (comfortable/compact) · Band (ซ่อน/แสดง 6 แถว และ chip ของแถว info/usage ทีละตัว) · Usage style และเกณฑ์เตือน · Clawd extras (ของประดับ, ลูกเล่น) · Progress bar (3 ปุ่ม + ตัวอย่าง) · Alerts (แจ้งเตือน turn ≥ 1 นาที/agent ล้มเหลวผ่าน `$.ui.notify`, toast เมื่อ 5H/7D ≥ 90% ครั้งเดียวต่อรอบ) · Agents and safety (Step reports = tool `mcp__sabai__step`, Guard ปิดไว้ก่อน: 4 rule เลือก Block = `tool.call` → `{ deny }` / Ask = `tool.check` → `{ decision: 'ask' }` / Off ได้ทีละ rule) · Look: Raised (ค่าเริ่มต้น) หรือ Flat สลับ light/dark ตาม OS · Reset (กดสองครั้ง) · ทุกค่าเก็บใน `$.store` (`prefs`, `skin`, `bar`)
- **Chat** (กลุ่มใน Settings, เปิดปิดทีละข้อ): แถว Edit/Write/Read/Bash วาดเป็น step บรรทัดเดียวแบบ minimal (icon เส้น · หัวข้อ · รายละเอียด · meter · pill ผลลัพธ์ · เวลา ⚡/🐢) · ผล test ของ bun/jest/vitest/pytest/cargo/go · callout `> [!NOTE]` เป็นกล่อง + บอก Claude 1 บรรทัดใน system prompt · spinner ภาษาไทย · receipt ใต้คำตอบของ turn ที่ทำงาน (ไฟล์ที่แก้ · ผล test · command) · ป้าย guard เป็น icon โล่สีเขียวชิดขวาของแถวบนพร้อมจำนวนที่กันได้ (desktop ไม่มีแถวป้ายโหมดใต้ช่องพิมพ์) · Clawd แสดงอารมณ์ (ตกใจ · เสียใจ · ฉลอง · เหงื่อตก · หลับ) · สีในหน้า chat ใช้ theme key ของผู้ใช้
- **ใช้ได้ทุกเครื่อง:** ไม่อ่านไฟล์ภายนอก ไม่แตะ credential ข้อมูลที่หาไม่ได้จะถูกซ่อน

## 2. การตัดสินใจ

| เรื่อง | เลือก | เหตุผล |
|---|---|---|
| โครงสร้าง | marketplace `claude-sabai`, mod ละโฟลเดอร์ใน `plugins/` | เปิด/ปิดทีละตัว |
| Surface | desktop Code tab เท่านั้น | terminal ไม่ถูกแตะเลย ให้เบาที่สุด ผู้ใช้เลือกเองว่าจะทำงานที่ไหน |
| ภาษา | อังกฤษอย่างเดียว | ตัด i18n ออกพร้อม `sabai-spinner` |
| 7D <model> | ตัดทิ้ง | engine ไม่มีค่านี้ ทางเดียวคือให้ mod อ่าน OAuth token เอง |
| ปุ่ม / status line | icon ในแถวบนข้างแถว info · ไม่มี status line | เดิมตัดปุ่มออก ตอนนี้เพิ่มกลับเฉพาะเรียก feature · `$.ui.status` ไม่แสดงใน Code tab |
| ตั้งค่า | pane Settings + slash command | `/config` ใช้ใน Code tab ไม่ได้ |

## 3. บทเรียนจาก engine (Claude Code 2.1.29x)

- `$` ส่งข้าม import ไม่ได้: helper ที่รับ `$` ต้องอยู่ในไฟล์เดียวกับ `register`
- ตาราง element ของ terminal มี `Svg` แต่วาดไม่ได้ ต้องแยกด้วย `e.surface`
- desktop วาด Svg เป็นรูปภาพ: ใน column element พี่น้องถูกตัดขึ้นบรรทัดใหม่ จึงวาดทั้ง band เป็น SVG เดียว · ใน `Box flexDirection="row"` Svg วางข้าง `Markdown` ได้ แถวบน (info + icon ที่กดได้เป็นรูปในลิงก์ของ `Markdown`) จึงทำแบบนี้ · ไม่ส่ง `width` = ย่อ markup ที่กว้างกว่า slot ให้พอดี (ไม่ขยาย) จึงวาดกว้าง `bodyColumns × 8.25` ให้เต็มเสมอ · `Svg` ต้องกว้าง/สูง 1–4096 px
- session ของ Code tab เริ่มด้วย `surfaces = []` แล้ว desktop ค่อย attach ทีหลัง และบางครั้งขอวาด band ก่อน attach จึงต้อง setUp ได้จากทั้งสามทาง (start, attach, การวาดครั้งแรก) แต่ครั้งเดียว
- `session.measure` มาเมื่อมี response ใหม่เท่านั้น ตอนโหลดต้องอ่าน `$.session.usage()` เอง
- งานที่เริ่มจาก press ถูกยกเลิกเมื่อ press จบ ต้องรันผ่าน `$.clock.after`
- `$.ui.status` ไม่แสดงใน Code tab · `/config` ใช้ไม่ได้ใน Code tab
- types ของ mod API ไม่มีใน npm และ `plugin test/validate` ไม่วางให้ — CI จึงตรวจ type ไม่ได้ ใช้ pre-commit ในเครื่องแทน

## 4. Backlog

เรียงตามลำดับที่ควรทำ: งานเล็กที่ต่อจากของที่มีอยู่ก่อน แล้วค่อยงานใหญ่ · งานที่เสร็จแล้วดูใน §5

### P1 — ทำต่อเลย (เล็ก, ต่อยอดของเดิม)

ว่าง (R1b เสร็จใน 2.10.0, B1 ใน 2.10.1) · งานถัดไปคือ U1 ใน P2

### P2 — ถัดไป (กลาง)

| ID | กลุ่ม | งาน | ขนาด | หมายเหตุ |
|---|---|---|---|---|
| U1 | Band · usage | สไตล์ usage 4 แบบ (Tiles/Rings/Columns/Rows) สำหรับ compact | M | comfortable เสร็จใน 2.3 · compact ยังเป็นการ์ดบรรทัดเดียวและไม่สน `usageStyle` |
| R2 | Agents pane | ให้สอดคล้องกับกล่อง race และแสดงข้อมูลมากขึ้น: tile ของทุก call, เวลาและ token ต่อ agent, ไฟล์ที่แตะ, ผลลัพธ์ | M–L | ระวัง `PANE_BUDGET` และ limit 100k |
| R3 | Band · live strip | ต่อยอดการทำงานและการแสดงผล | M | ต้องกำหนด scope ก่อนเริ่ม (ยังไม่ชัดว่าจะเพิ่มอะไร) |

### P3 — ภายหลัง (ใหญ่)

| ID | กลุ่ม | งาน | ขนาด | หมายเหตุ |
|---|---|---|---|---|
| K1 | Clawd | redesign แบบมืออาชีพ ทีละตัว (sprite, ท่าทาง, ของประดับ) และเพิ่มตัวใหม่ | L | ทำเป็นรอบ ทีละตัว · sprite หนึ่งตัว ~14k ต้องดูขนาด band |
| C1 | Mod ใหม่ | File tree pane | L | อ้างอิง data-goblin/claude-code-filetree · น่าจะเป็น mod แยกใน `plugins/` มากกว่าใส่ใน sabai |

### ไม่ทำ

| ID | งาน | เหตุผล |
|---|---|---|
| S-A | Customize มุม, พื้นหลัง, animation | ส่วนที่มีค่าทำแล้ว (density 2.2, Raised/Flat 2.8, ปิดลูกเล่นได้, เคารพ reduced motion) · band ตั้งใจไม่วาดพื้นหลัง · มุมอย่างเดียวไม่คุ้ม |
| S-C | Custom skin (hex), export/import JSON, skin ต่อ project | ขัดกับการตัดสินใจใน 2.8 ที่เหลือ 2 look ซึ่ง test รับประกัน contrast ≥ 4.5:1 ทั้ง light/dark · สี hex อิสระรับประกันไม่ได้ |
| A1–A4 | ธีมทั้ง transcript | เสี่ยงพังเมื่อ Claude Code อัปเดต |

### ข้อจำกัดที่รู้แล้ว (ตั้งใจไม่แก้)

- wink ของ Clawd วน 3.2s: ถ้าวนทุกวินาทีจะกะพริบถี่เกิน
- engine รุ่นนี้ไม่มี Grep tool จึงไม่มีให้ guard ปิด (`grep`/`rg` ใน shell จับอยู่แล้ว)
- lane ที่ merge เรียง tile ทีละ agent เพราะ call ไม่มีเวลาให้เรียงสลับกัน
- แถว info สูง 22 px · ต่ำกว่า 240 px branch ถูกตัดไม่ต่ำกว่า 6 ตัว

## 5. ประวัติเวอร์ชัน

- **2.10.1** ปิด B1: แถว info ที่แคบไม่ตัดชื่อเหลือ `…` ล้วนอีก ลำดับการหลีกเมื่อที่ไม่พอเป็น Node → git user → ตัวนับ sync → ตัด folder (เหลืออย่างน้อย 3 ตัว) → เอา folder ออก → ตัด branch (เหลืออย่างน้อย 6 ตัว) ให้ branch อยู่นานที่สุด · ชื่อที่สั้นกว่าจำนวนตัวขั้นต่ำไม่ได้ `…` ต่อท้ายอีก (เดิม `main` กลายเป็น `main…`) · alt text บอกเฉพาะสิ่งที่วาด
- **2.10.0** ปิด R1b: บรรทัด step ของ lane บอก call ล่าสุดเมื่อไม่มี progress (agent และ Main ระหว่าง call เช่น `· Edited svg.ts` แทน `· Working`), แต่ละ lane นับ `✓`/`✗` ของตัวเองข้างเวลา (lane ที่ merge รวมกัน, lane แบบ slim ก็มี), alt text บอกจำนวนต่อ lane · ความหมายของ icon และสีของ tile อยู่ใน README แทนการวาดใน band
- **2.9.1** mod เริ่มทำงานได้ทุกครั้งใน session ใหม่: `session.attach` เช็ก surface ใน hook เอง (ไม่ใช้ matcher) และการวาด band ครั้งแรกที่มาก่อน attach เรียก setUp ครั้งเดียว · มี test กันไว้
- **hub 1.0.0** status line สำหรับ terminal (`statusline/hub.sh`) 2 บรรทัดแบบ C1: โฟลเดอร์ · branch ↑↓± · model · effort · ค่าใช้จ่าย · เวลา / CTX · 5H (เวลาที่เหลือ `1h 12m`) · 7D (วันและเวลา `Fri 04:00`) ใช้สี ANSI ตาม theme ของ terminal, jq ครั้งเดียว git ครั้งเดียว ~35 ms (ตัวเดิม ~300 ms), ไม่ใช้ network ไม่แตะ token, มี test และรันใน CI
- **2.9.0** mod ทำงานเฉพาะ desktop Code tab: session ที่เป็น terminal หรือ `-p` ไม่ถูกแตะเลย (ไม่รัน git/node, ไม่ลงทะเบียนคำสั่งหรือ tool `step`, ไม่เพิ่ม callout ใน system prompt, ไม่มี guard/การแจ้งเตือน, ไม่วาดอะไร) เพื่อให้ terminal เบาที่สุด · mod เริ่มทำงานตอน `session.start` ถ้ามี desktop อยู่แล้ว ไม่งั้นรอ `session.attach` ของ desktop · ลบโค้ดวาด terminal ทั้งหมด (toolbar แบบปุ่ม, แถวข้อความ, SessionMode) และ path ที่ไม่ได้ใช้แล้ว (`info` ใน `bandSvg`, chip โล่ใน info row, `blocks`)
- **2.8.0** สีเหลือ 2 แบบให้เลือก (Raised เป็นค่าเริ่มต้น: การ์ดขาว/#2d2d2b ลอยจากพื้น, Flat: แบบเดิม) ทั้งคู่สลับ light/dark ตามแอป เอา skin 10 แบบออก, แก้บั๊ก (toolbar หายเมื่อไม่มีแถวอื่น, guard ตามค่า guard ไม่ใช่แถว info, เตือน limit ที่ Red at, นับ agent ที่ fail แยก, เวลาไม่ซ้ำข้าง race, แถวบนแคบไม่ล้น), ลดขนาดภาพที่วาดทุกวินาที (race ใช้ `<use>`, icon/การ์ด info ใช้ CSS เฉพาะที่ใช้, สรุป agents ไม่มี CSS animation, receipt ใช้ hash เป็น key: band+แถวบน 49.8k→35.3k), settings/agents pane เรียบร้อยขึ้น (Reset ต้องกดสองครั้ง, ▸/▾ Report, Clear finished, ตัวเลือกเฉพาะ desktop ระบุชัด)
- **2.7.0** desktop มีแถวบนเหนือ band: แถว info เป็น SVG ของตัวเองชิดซ้ายทั้งหมด (Node แสดงเวอร์ชันเต็ม) ลำดับเป็น git user แล้วค่อย Node, แถว info มีการ์ดพื้นสีเดียวกับ band, guard ย้ายไปชิดขวาเป็น `shield-check` สีเขียว (กดแล้วเปิด Settings) และ toolbar เป็น icon Lucide ชิดขวา (Compact `fold-vertical`, Agents `bot`, Settings `settings`) วาดเป็นรูปในลิงก์ของ `Markdown` แล้วรับการกดด้วย `onLinkPress` เพราะ `Button` บน desktop ใส่ `Svg` ไม่ได้ · terminal คงแบบเดิมทั้งหมด
- **2.6.0** band มี skeleton แบบนิ่งตอนยังโหลด (แถว info เป็นแท่งเทา, usage เป็น track ว่างกับ `—` ไม่มีตัวเลข, สูงเท่าตอนโหลดเสร็จ layout ไม่กระโดด) และ empty state "No usage reading yet" เมื่อ engine ตอบแต่ไม่มี usage
- **2.5.0** ปิด R1: ตัววิ่งใน race เดินตามจำนวน call เมื่อไม่รู้ progress (10%→85%, ครึ่งทางที่ 8 call), รอยเท้าตามหลังตัววิ่งเป็น pixel icon ต่อ call (🔍 read, ✏️ edit, `>_` command, ⚗️ test ผ่าน, ✗ ล้ม) ไม่ซ้ำ, พื้นของ lane ที่วิ่งเป็นเส้นประสีส้มของ Clawd ที่เลื่อน, เส้นพื้น/ธง/วงกลมใช้สีเทา `m` แทนสี track ที่แทบมองไม่เห็นใน auto, Main ที่รอ agent และ agent ที่จบแล้วย่อเหลือบรรทัดเดียว 18 px (Main ระหว่าง call เป็น `thinking` ยังเต็ม lane)
- **2.4.5** ปิด M22–M24: receipt แยกคำสั่งอ่านกับเขียนได้ถูกขึ้น (`find -delete`, `git branch -D`, `$(…)`, `2>/dev/null`), Edit แบบ `replace_all` นับบรรทัดจาก patch จริง, race ล้าง lane ของ agent ที่จบไปแล้วเมื่อเริ่ม turn ใหม่, terminal ไม่วาด Clawd ซ้ำ, ปิด Activity แล้วยังมีเวลาใต้ working, ท่าหาวเป็นตัว z, ตามองขึ้นสูง 2 px, ท่าโบกมือตอน reduced motion เหลือแขนยกข้างเดียว, settings pane เล็กลง ~22k (swatch ที่ไม่ขยับไม่แนบ stylesheet ของ animation) และมี test กันไว้ < 85k, branch ถูกตัดเหลือไม่ต่ำกว่า 6 ตัว, Node แสดง v เสมอ
- **2.4.4** toolbar แบบใหม่: ปุ่มคำสั่งมีสัญลักษณ์นำหน้า (◎ Review · ⇲ Compact · ↶ Rewind · ↻ Resume), Review บอกจำนวนไฟล์ที่ยังไม่ commit, Compact บอก % context เมื่อถึง warnAt และเป็นปุ่ม primary ทีละปุ่ม (Agents ก่อนเมื่อมี agent ทำงาน)
- **2.4.3** ปิด M25: หัว race/tiles/การ์ด agent/เวลาใน step ไม่ทับกัน, วัดความกว้าง emoji และ CJK ถูก, ตัด note ไม่กลาง emoji, receipt ของคำตอบซ้ำไปอยู่ใน notice, `/clear` ล้าง state ของ turn ครบ, เตือน limit ไม่ซ้ำหลัง reload, band ไม่ใช้นาฬิกาปี 1970, Write นับตาม diff, test ที่อ่านผลไม่ได้ล้างผลเก่า, call ขนานไม่ชนกันใน race, guard จับ `checkout ./`/`-f`, `switch -f` และ heredoc ที่ pipe เข้า shell
- **2.4.2** ไม่แสดงเวลาของ turn ที่เริ่มก่อน sabai โหลด (เดิมนับจากปี 1970), guard อ่านคำสั่งทีละคำ (ทุก rm ทุก target, flag ยาว, quote, `FOO=1 git …`, `bash -c`, .env ที่อ่านจริง), guard ปฏิเสธเมื่อตรวจไม่ได้ใน tool.check, เวลา turn เดินต่อหลัง reload กลาง turn, จุด dither เป็น path เดียวต่อ class (band จอกว้างไม่เกิน limit 100k)
- **2.4.1** แก้แถว info: ชื่อ branch ไม่ค้างสภาพถูกตัดเมื่อ guard หาย, โล่ไม่มีข้อความว่าง, วัดความกว้าง emoji ถูก, ไม่ตัด emoji ที่ต่อกันกลางตัว
- **2.4.0** แถว info แบบใหม่ บรรทัดเดียว minimal (ชื่อโปรเจกต์ · ป้าย branch + sync · guard, Node, git user สีจาง)
- **2.3.0** Clawd บอกอารมณ์พร้อมเหตุผล + ลูกเล่น (โบกมือ หาว มองกล่อง race/limit), usage เต็มความสูง band เลือกได้ 4 แบบ (Tiles/Rings/Columns/Rows) และเอาค่าคาดการณ์ออก, กล่อง race ตัดตัวนับเกมออก ตั้งชื่อ lane ตามงาน รวม agent ชนิดเดียวกัน, settings จัดกลุ่มใหม่ + Reset
- **2.2.0** band แบบ 3 แผง (Clawd · info/usage · race เกมวิ่งของ Main และ agent), คาดการณ์ 5H/7D, เลือกสิ่งที่แสดงใน band, density compact, Clawd ตามเวลา/เทศกาล
- **2.1.0** เพิ่ม turn receipt, guard แบบเลือก Block/Ask/Off ทีละ rule (+ rule discard) และอารมณ์ของ Clawd · guard ล้มแบบปิด
- **2.0.0** เปลี่ยนชื่อ mod จาก `sabai-band` เป็น **`sabai`** เพราะครอบคลุมมากกว่า band แล้ว
- **1.1.0** เพิ่มส่วน Chat (step ของ tool, ผล test, callout, spinner ภาษาไทย, โล่ guard ใน band)
