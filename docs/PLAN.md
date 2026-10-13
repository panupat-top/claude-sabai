# claude-sabai — Plan

> สถานะ (2026-10-13): sabai 2.14.2 ทำงานเฉพาะ desktop Code tab · hub 1.0.0 status line สำหรับ terminal · ประวัติทุกเวอร์ชันอยู่ใน §5
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

R2 (agents pane ใหม่) กำลังทำบน branch `sabai-2.13.0` ยังไม่ commit · ทำทีละขั้นตามลำดับข้างล่าง แต่ละขั้นเสร็จแล้วค่อยไปขั้นถัดไป

#### ขั้น 0 — ปิด 2.13.0 (ของที่ทำไปแล้ว)

สิ่งที่มีใน branch แล้ว (test 323 ผ่าน, `tsc`/validate ผ่าน):
- **โครง pane:** Overview (crew ปัจจุบัน) → AGENTS (lane ละ agent + ปุ่ม View) → Detail ของตัวที่เลือก → กล่อง Earlier
- **Overview (OV-1):** หัวเรื่อง · Clawd ทุกตัวพร้อม mood และป้าย · bar แบ่งช่องละ agent · tile CALLS/TOKENS/TIME/FILES
- **Lane (D3):** Clawd ตาม mood · ชื่องาน · ประโยคไทยที่ใส่ตัวเลขจริง · bar ตามสไตล์ bar · เวลา
- **Detail:** head (Clawd ใหญ่, tag mood, meta, call ล่าสุด, meter STEPS/CONTEXT/CALLS) · SUMMARY ภาษาไทย (บรรทัดข้อเท็จจริง + bullet จาก Haiku ผ่าน `$.model.complete`) · TOOLS แยก BUILT-IN/SKILLS/MCP · STEPS (note ของ step tool) · ACTIVITY (8 ล่าสุด / All calls) · FILES แบบ F1 (แก้ก่อน, +N −M, NEW) · Report (รวมรอบก่อน) · Brief
- **Crew:** agent ที่ turn หลักเดียวกันสั่ง = crew เดียว (workflow ตาม `runId`, agent ลูกตาม parent, run เก่าก่อนมี crew = crew เดียว) · เก็บ 5 crew ล่าสุด + crew ที่ยังรัน · ส่งงานต่อให้ agent ที่จบแล้ว = รอบใหม่ใน crew ปัจจุบัน เก็บ report เดิมไว้ (≤ 3 รอบ) · หยุด (aborted) แยกจาก failed
- **Earlier:** กล่องกรอบมน (E1) พับเป็นบรรทัดเดียวระหว่างที่ crew ปัจจุบันทำงาน (E2) · ป้ายวัน TODAY/YESTERDAY/วันที่ เฉพาะเมื่อข้ามวัน (D1) · Clear ที่หัวกล่อง
- **Mood:** working / thinking / quiet (เงียบ ≥ 30 วิ) / context (≥ 80% เฉพาะเมื่อ model เดียวกับ Main จึงรู้ window) / failed / stopped / done
- **ข้อมูล:** `tool.call` ไม่มี matcher บันทึกทุก tool ของ subagent (ไม่นับ Task tools และ step tool) · tool ที่ race ไม่เคยนับ (Grep, Skill, MCP …) นับใน lane ของ subagent บน band ด้วย ให้ตัวเลขตรงกับ pane
- **Settings › Agents › Thai summary** (ค่าเริ่มต้นเปิด)
- **ขนาด:** budget 70k วาดตามลำดับ overview → detail → แถว Earlier → lane · Clawd ใน pane เป็น path, ใส่เฉพาะสี/animation ที่ใช้, font ตั้งใน stylesheet, icon ใช้ `<use>` (agent 5 ตัว ≈ 44k)

ยังต้องทำก่อน release:
1. ✅ **A — ทดสอบบน desktop** (ผ่าน 2026-10-13: สรุปไทยจาก Haiku, MCP และ Skill มี `agentId`, NEW, stopped, Earlier, ป้ายวัน · เจอและแก้: detail แสดงภาพของ agent ตัวก่อนเพราะ key ของ Svg ตายตัว, path นอก project ยาว) เดิม: สรุปไทยจาก Haiku, MCP/Skill ใน TOOLS, badge NEW, สถานะ stopped, กล่อง Earlier พับ/กาง, ป้ายวัน · mood quiet และ context มีแค่ unit test · ถ้า engine ไม่ให้ข้อมูลส่วนไหน ส่วนนั้นซ่อน
2. ✅ **B — docs:** README (pane ใหม่, privacy: ส่ง report ไปให้ Haiku สรุปผ่าน API ของ session, setting Thai summary) · CLAUDE.md (architecture ของ pane, ข้อยกเว้นภาษาไทยข้อ 2: ประโยคไทยใน lane และสรุปไทย) · §5 ของไฟล์นี้
3. **C — release 2.13.0:** version ใน plugin.json และ marketplace.json · commit · merge · push · อัปเดต production (เมื่อเจ้าของสั่ง)

#### ขั้น 1 — โครงและข้อมูล (preview รอบ A, งานของ 2.14.0) ✅ เลือก A3 · ปิดได้ทั้งสองทาง · T3-a · M1 (ทดสอบบน desktop ผ่าน)

ทำ preview รอบเดียวกันเพราะตำแหน่งของ Main เปลี่ยนโครงทั้ง pane

| ID | งาน | รายละเอียด | ขนาด |
|---|---|---|---|
| T1 | จัดโครงใหม่ แยก group ให้ชัด | ลำดับ Overview → Lanes → Earlier → Detail · แต่ละส่วนเป็น group ที่อ่านง่ายและสวย · เสนอไอเดียหลายแบบพร้อม preview · ข้อควรระวัง: Earlier ที่กางอยู่จะดัน Detail ลงไปไกล (เสนอทางเลือกไว้ใน preview ด้วย) | M |
| T2 | ปิด view ได้ | กด View ซ้ำ หรือปุ่ม ✕ แล้ว Detail ไม่แสดง agent | S |
| T3 | Empty state ของ Detail | ตอนยังไม่ได้เลือก agent หรือปิด view ไปแล้ว · ตัดสินใจว่าเลือกให้เองแบบเดิม (ตัวที่ควรเข้าไปดู) หรือไม่เลือกให้ | S |
| T4 | แสดงงานของ Main ใน pane | เมื่อสั่งงานแล้วมีแค่ Main ทำ ก็ให้ pane แสดงด้วย · **กลับคำตัดสินใจเดิม** ("Main ไม่ต้องใส่ใน pane") · Main ไม่ใช่ `AgentRun` ข้อมูลต้องมาจาก race log / `turnLog` / receipt · ทางเลือก: lane แรกของ crew, การ์ดแยก, หรือเป็นประวัติ turn ใน Earlier ด้วย · ระวัง budget และซ้ำกับ chat/receipt | L |

#### ขั้น 2 — งานเล็ก ไม่ต้อง preview ✅

| ID | งาน | รายละเอียด | ขนาด |
|---|---|---|---|
| T5 | tile ของ Overview ไม่มี bar | เอา bar/กราฟเล็กออกจาก tile ทั้ง 4 ช่อง เหลือตัวเลขและข้อความ | S |

#### ขั้น 3 — หน้าตา (preview รอบ B รวมหน้าเดียว) ✅ T6 คงแบบเดิม · T7 S3 · T8 G1 + wording ตามตาราง · เอา tile FILES ออกจาก overview

| ID | งาน | รายละเอียด | ขนาด |
|---|---|---|---|
| T6 | bar ของ Overview | น่าสนใจขึ้น มีลูกเล่นหรือความสนุก และต้องมีประโยชน์ต่อผู้ใช้ · เสนอหลายแบบพร้อม preview | M |
| T7 | lane ตอนถูกเลือก + ปุ่ม View | หน้าตาตอน selected และปุ่ม View ให้สวยขึ้น · preview | S–M |
| T8 | Detail เป็น group + wording | แบ่ง group ให้อ่านง่าย · ปรับ wording · preview | M |

#### ขั้น 4 — ปิด 2.14.0 ✅

ทดสอบบน desktop → docs (README, CLAUDE.md, §5) → release 2.14.0 เมื่อเจ้าของสั่ง

#### ค้างจาก review หลัง 2.14.1 (รอบถัดไป)

| ID | งาน | รายละเอียด | ขนาด |
|---|---|---|---|
| V1 | contrast บนพื้น tint | ป้าย mood ใน head, ป้าย NEW, `+added` ในแถวไฟล์ และตัวนับใน chip ของ MCP/skills ต่ำกว่า 4.5:1 ในบาง look · icon สีขาวบน tile แบบ `c-ok`/`m` ใน dark ต่ำกว่า 3:1 · เพิ่ม test ที่วัดบนพื้น tint | S–M |
| V2 | ค่า CONTEXT ใน head ถูกตัด | ที่ pane กว้าง 310–400 px · ถ้าค่าเต็มไม่พอดีให้ใช้ % แทน · ที่ 240 px "active … ago" ทับป้าย mood | S |
| V3 | สิ่งที่เกิน budget หายเงียบ | แถว Earlier และกล่องย่อยของ Detail ที่ไม่พอดีไม่มีตัวนับเหมือน lane | S |
| V4 | ขอบ ๆ ของ state | `pending` ค้างหลัง hot reload · `finished` ไม่ล้าง `doing` · ผล test ของ agent อ่านแค่ stdout (race อ่าน stderr ด้วย) · agent ของ workflow ที่ถูกปลุกหลุดไป crew `turn:` · crew ที่มีแต่ Main ใน Earlier ขึ้น "0 agents" · key ของ overview ตายตัว (`crew`) | M |
| V5 | performance | รวม update ต่อ call ของ `logAgentCall` เป็นครั้งเดียว · จำกัด Haiku ที่เรียกพร้อมกัน | S |

### P2 — ถัดไป (กลาง)

| ID | กลุ่ม | งาน | ขนาด | หมายเหตุ |
|---|---|---|---|---|
| R2 | Agents pane | ย้ายไป P1 (กำลังทำ, แผนละเอียดอยู่ข้างบน) | M–L | ระวัง `PANE_BUDGET` และ limit 100k |
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

- **2.15.0** agents pane รอบสาม (preview 2 รอบ): ลำดับ Now → Viewing → Earlier (A1) · ส่วนย่อยใน Viewing ไม่มีกรอบ (A4) · หัวกล่อง Now บอกสถานะ (`3 running · 1 done · 1 failed`) แทน headline ของ overview (B1) · overview เป็น timeline ของ crew: แถบละตัวบนแกนเวลาเดียว, Clawd ขี่ปลายแถบของตัวที่ยังทำงาน, ✓/✗/✋ ที่ตัวจบ, รับ 6 แถวแล้วนับที่เหลือ (B2) · lane มีแถบสีตาม mood ทางซ้าย (C1) · C4 (ปุ่ม View เป็นลูกตา Lucide ใน image link) ทำแล้วแต่ถอยกลับเป็นปุ่ม View: บน desktop image link ใน pane กดไม่ติดเลยแม้ย่อเหลือ 30×24 (ขนาดไอคอน toolbar) · lane ที่ดูอยู่มีกรอบ + tint + spotlight และ Clawd โบกมือ, หัวของ Viewing ด้วย (D1) · Main ใส่หมวกกัปตัน (ถือกล้องส่องทางไกลตอนทำงาน) และมี badge `main` · 👑 MVP ใน Earlier (D5) · หัว Viewing แบบ A: ชื่อ+เวลา / mood + call ล่าสุด / STEPS·CONTEXT(`64k · 32%`)·TOKENS / type · model · effort ตัวเล็ก, "active … ago" เฉพาะตอนไม่ quiet · wording (E): Viewing, Pick an agent, Tools · N kinds, Calls · latest N of M (ตัด "N earlier calls" ในภาพ), Asked to บรรทัดแรก + More, Earlier · ✓N ✗N · ตัดช่องแชทออกตามที่เลือก (ประโยคไทยอยู่ใน lane ที่เดียว) · ต้องทดสอบบน desktop: Text `wrap` ของ Asked to
- **2.14.2** แก้จาก review: pane นับ budget ตามขนาดจริงใน tree (source ที่ escape แล้ว + alt) จึงไม่ทะลุ 100k จนว่างตอนเปิด detail ของ agent ที่มี call ยาว และหยุดวาด lane หลังตัวแรกที่ไม่พอดี · Clear ลบ crew ใน Earlier ได้ครบ (คิด crew ที่แสดงจาก Main กับ agent รวมกัน) · Main ของ turn เก่าที่ agent ย้ายไป turn ใหม่ไม่เด้งขึ้นบน Now · ไฟล์ที่แก้ไม่หลุดจาก Files เมื่ออ่านไฟล์เกิน 40 · สรุปของ Haiku ลงรอบที่อ่านเท่านั้น · TOKENS นับเฉพาะ token ใหม่ (input + cache write + output, ไม่นับ cache read) · overview ไม่ให้หัวข้อทับ "+N" และ ✗ ของ CALLS ไม่ทับตัวเลขที่ pane แคบ · ชื่อ lane ที่ดูอยู่ไม่ชนเวลา · สรุปของ Haiku เป็นไทยแม้ report เป็นอังกฤษ
- **2.14.1** agents pane: ภาพในกล่องเต็มความกว้างแล้ว ไม่เหลือช่องว่างทางขวา (กรอบ + padding ของกล่องกิน ~20 px ไม่ใช่ 36 ตามที่วัดบน desktop, ที่เผื่อปุ่ม View ข้าง lane 78 px)
- **2.14.0** agents pane รอบสอง (R2 ต่อ): แบ่งเป็น 3 กล่อง Now (overview + lane) / Earlier / Detail (A3) · Main เป็น lane ของทุก crew (M1, atom `mains` แยกจาก `agents` ไม่ให้ band/race เห็น, บันทึกทุก tool ของ Main, คำตอบของ Claude เป็น Answer, ไม่เรียก Haiku, ไม่มี mood quiet) · turn ที่จบโดยไม่มี call และไม่มี agent ไม่นับเป็น crew (กัน turn ของ notification ดัน crew ลง) · turn ใหม่ปิด run ของ Main ตัวก่อนเสมอ · กด View ซ้ำหรือ ✕ Close เพื่อปิด, ไม่เลือก agent ให้เองแล้ว: Detail ว่างเป็น Clawd หลับ + บรรทัดเตือนตัวที่ควรดูพร้อม View it (T2/T3-a) · lane ที่ดูอยู่: แถบซ้ายสี Clawd + ชื่อตัวหนา + ปุ่ม Viewing (S3) · Detail เป็นกล่องย่อย Summary / Plan / Tools used / Calls / Files / Report (Answer) / Task พร้อมจำนวนที่หัว (G1) · overview เหลือ 3 tile (CALLS/TOKENS/TIME) ไม่มี bar · บทเรียน: `update()` ต้องอ้าง atom ตรง ๆ ในที่เรียก ส่ง atom ผ่านตัวแปรไม่ได้ (module ไม่โหลด)
- **2.13.0** agents pane ใหม่ (R2 รอบแรก): Overview ของ crew (Clawd ตาม mood, bar แบ่งช่องละ agent, tile CALLS/TOKENS/TIME/FILES) · lane ละ agent พร้อมประโยคไทยตาม mood ที่ใส่ตัวเลขจริง · Detail (head + meter, สรุปไทย = ข้อเท็จจริงที่นับเอง + bullet จาก Haiku ผ่าน `$.model.complete`, TOOLS แยก built-in/skills/MCP, STEPS, ACTIVITY, FILES แบบ F1, Report รวมรอบก่อน, Brief) · crew ตาม turn หลัก (workflow ตาม `runId`, agent ลูกตาม parent) เก็บ 5 crew · กล่อง Earlier พับได้ แบ่งตามวันเมื่อข้ามวัน · stopped แยกจาก failed · บันทึกทุก tool ของ subagent และนับใน lane ของ race ด้วย · Settings › Agents › Thai summary · path นอก project ย่อเหลือ 2 folder · บทเรียน: Svg ใน pane ที่ key เดิมแต่เปลี่ยนเรื่องที่แสดง (สลับ agent) desktop คงภาพเก่าไว้ ต้องใส่ id ของเรื่องใน key · ประโยคไทยและสรุปไทยเป็นข้อยกเว้นภาษาไทยเพิ่มจาก spinner ตามที่เจ้าของเลือก
- **2.12.0** settings pane ใหม่: เรียง group จากสิ่งที่เห็นบ่อยไปสิ่งที่ตั้งครั้งเดียว (Look → Usage → Info row → Clawd → Agents → Conversation → Guard → Notifications → Reset) · ส่วนของ band ที่มีตัวเลือกของตัวเองมีปุ่ม On/Off ที่หัว group และซ่อนตัวเลือกเมื่อปิด (Agents ยังแสดง Step reports เพราะใช้กับ agents pane ด้วย) · Tasks, Activity, Toolbar เป็น pill ใน Look · Layout, Cards และสไตล์ usage มีภาพโครง (`densityPreview`, `usageSketch`) หรือ swatch วางเหนือปุ่มของตัวเลือกนั้น อันที่ใช้อยู่มีกรอบสีของ Clawd กับ ✓ (เคยลองให้กดที่ภาพผ่าน Markdown image link แต่บน desktop ภาพใหญ่กดไม่ค่อยติด) · Svg ใน pane ต้องส่ง width/height ไม่งั้นถูกยืดเต็มความกว้าง · Bars ยังเป็นปุ่ม และ preview มีขนาดคงที่ (≤ 320 px) บนกรอบที่มีป้าย PREVIEW · แถว info ตามที่เปิด, ตัวอย่าง step/test/receipt ตาม toggle ของ chat · Safety เปลี่ยนชื่อเป็น Guard, ข้อความสั้นลงและไม่ใช้ px · pane ทั้งหมด ~50–67k ตัวอักษร
- **2.11.0** ปิด U1: compact วาด usage ตาม `usageStyle` ทั้ง 4 แบบ ที่ความสูง 50 px (`USAGE_MIN_H` ความสูงต่ำสุดเดียวกับ comfortable) แทนการ์ดบรรทัดเดียว 22 px ซึ่งถูกลบออก · ที่ 40 px ตัวอักษรทับ bar จึงไม่เตี้ยกว่านี้ · band compact ที่กว้าง ≥ 720 px สูงขึ้น 28 px แต่ที่แคบกว่า 400 px เตี้ยลง (เดิมการ์ดเรียงลงเป็น 3 แถว) · comfortable ที่แคบกว่า 480 px ยังใช้การ์ดสองบรรทัด
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
