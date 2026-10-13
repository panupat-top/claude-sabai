# claude-sabai — Plan

> สถานะ (2026-10-13): sabai 2.20.1 ทำงานเฉพาะ desktop Code tab · hub 1.0.0 status line สำหรับ terminal · ประวัติทุกเวอร์ชันอยู่ใน §5
> อ้างอิง (MIT ทั้งหมด): [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) ·
> [JohnnyVizz/claude-kit › savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) ·
> [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree)

## 1. สิ่งที่มีตอนนี้: `sabai`

band เหนือช่องพิมพ์ สไตล์ pixel แบบ savvy-progress วาดเป็น SVG บน desktop Code tab เท่านั้น ทุกแถวซ่อนได้ใน Settings

| แถว | แสดง | ที่มาของข้อมูล |
|---|---|---|
| Info | แถวบนเหนือ band ชิดซ้ายทั้งหมด: ชื่อโปรเจกต์ · ป้าย branch `↑ ↓ ±` · git user · Node (เวอร์ชันเต็ม) | `git`, `node` ผ่าน `$.process.run` (timeout 5 วิ, ไม่รอตอนเริ่ม) · ตาม folder เมื่อ session ย้าย (`$.session.cwd`) · หาไม่ได้ = ซ่อน |
| Live | step ที่กำลังรันเป็นไอคอนชนิด call (กะพริบ) พร้อมเวลาของ call หรือ `thinking` ระหว่าง call · ขวาเป็นรอยไอคอน call ของ turn (`+N` เมื่อเกิน) · บรรทัด `+/−` และผล test | `turn.start` / `turn.step` / race log / `turnLog` |
| Tasks | Clawd · bar (dither/blocks/solid) · pill `n/total` · % | `TaskCreate` / `TaskUpdate` / `TodoWrite` ของบทสนทนาหลัก |
| Clawd | แผงซ้ายของ comfortable: อารมณ์ + เหตุผล + ลูกเล่น · `● N running` เมื่อเป็นตาผู้ใช้แต่ยังมี shell/Monitor เบื้องหลัง | `moodOf` / `moodLine` / `trickOf` · `backgroundTaskId` ของ Bash, `taskId` ของ Monitor |
| Crew | แถวใน compact/แคบ (comfortable กว้างใช้ Race แทน): Clawd ตัวเล็กต่อ agent พร้อมหมวก/ของ · งานล่าสุด · badge ✓ ✗ ✋ · เวลา | `agent.spawn` / `turn.step` / `turn.complete` |
| Usage | Context · 5H · 7D All พร้อม countdown · 4 แบบ (Tiles/Rings/Columns/Rows) ทั้ง comfortable และ compact · เตือน/แดงตั้งได้ (ค่าเริ่มต้น 70% / 90%) · ค่าประมาณ `~` ก่อน response แรกและหลัง compact/clear | `session.usage`, `session.measure` |
| Race | กล่องขวาสุดของ band (comfortable, ≥ 760 px) เมื่อมี agent: แถวละ 22 px ต่อ Main และ agent · stripe สีตาม mood · แผน `n/total` · quiet · จบแล้วกระโดด/ล้ม/✋ แล้วพับเป็น badge | hook ของ Read/Edit/Write/Bash + `tool.call` ไม่มี matcher |
| Toolbar | icon Lucide ชิดขวาของแถวบน: Guard (เมื่อเปิด) · Compact (บอก % เมื่อถึง warnAt) · Agents (นับที่ทำงาน) · Settings · สีทีละ icon: Agents ตอนมี agent ทำงาน ไม่งั้น Compact | `$.command.list`, `$.command.run` |

- **Agents pane** (`/sabai-agents`): 3 กล่อง **Now** (หัวบอก `N running · N done · N failed`, timeline ของ crew บนแกนเวลาเดียว, lane ของ Main และ agent ละ lane พร้อม stripe mood, ประโยคไทย, ปุ่ม View) → **Viewing** (head: Clawd, mood, call ล่าสุด, STEPS/CONTEXT/TOKENS · Summary ไทยจาก Haiku · Plan · Tools · Calls · Files · Report/Answer · Asked to) → **Earlier** (crew ก่อนหน้าพับเป็นบรรทัด, ป้ายวันเมื่อข้ามวัน, 👑 MVP, Clear) · crew ตาม turn หลัก / workflow / parent เก็บ `CREWS_KEPT` crew · วาดตามขนาดจริง (`PANE_BUDGET`) ให้ tree ไม่เกิน 100k
- **Settings pane** (`/sabai-settings`, `⚙`): Look (layout, การ์ด Raised/Flat, bar, แถวที่ไม่มีตัวเลือกของตัวเอง) → Usage → Info row → Clawd → Agents (Step reports, Thai summary) → Conversation → Guard (4 rule เลือก Block/Ask/Off ทีละ rule, ปิดไว้ก่อน) → Notifications → Reset (กดสองครั้ง) · ตัวเลือกที่เป็นภาพ (layout, การ์ด, usage) มีภาพโครงเหนือปุ่ม · ทุกค่าเก็บใน `$.store`
- **Chat** (เปิดปิดทีละข้อ): แถว Edit/Write/Read/Bash เป็น step บรรทัดเดียว (icon Lucide · หัวข้อ · รายละเอียด · pill ผลลัพธ์ · เวลา) · ผล test ของ bun/jest/vitest/pytest/cargo/go · callout `> [!NOTE]` · spinner ภาษาไทย · receipt ใต้คำตอบของ turn ที่ทำงาน · สีในหน้า chat ใช้ theme key ของผู้ใช้
- **สี:** pastel ชุดเดียว (`PALETTE`) ใช้กับไอคอน call, badge, stripe, แถบ และ timeline ทั้ง light/dark
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

### P1 — คำศัพท์ให้ตรงกับ docs ทางการ (2.21.0)

ตัดสินใจ 2026-10-13: D1 กลุ่มของ subagent เรียกตามที่มา **turn** / **workflow run** (docs ไม่มีคำเรียกกลุ่ม; ในโค้ดยังชื่อ `crew`) · D2 pane และตัวนับใช้ **Subagents** / subagent · D3 คง **done** (= completed ของ docs) · D4 คงป้าย **Main** (= main conversation) · ตารางคำศัพท์อยู่ใน CLAUDE.md › Glossary

| ขั้น | งาน | รายละเอียด |
|---|---|---|
| 1 | Glossary | ✅ ตารางใน CLAUDE.md |
| 2 | ข้อความ UI ✅ | subagent แทน agent ในประโยค/ตัวนับ · ชื่อ pane Subagents · pane ไม่ใช้ panel · general-purpose · งานของ subagent = description/prompt ไม่ใช่ task · request แทน step ของ model · ส่วน Plan ใน Viewing เป็น Progress · ใต้ Clawd `N background` (คำว่า "in background" ไม่พอดีกับช่อง 108 px) · แถว crew ของ band เป็นแถว Subagents (Settings, README, plugin.json) · ไทยใช้ "รายงาน" · แก้ test |
| 3 | Logic | L1 alt ของ race อ่าน state ดิบ (out/tripped/finished) · L2 race อยู่ใต้ toggle Activity แต่ subagent อยู่ใต้ Agents ให้รวมไว้กลุ่ม Subagents · L3 กลุ่มของ workflow ไม่มีป้าย · L4 teammate (agent teams) ไม่ใช่ subagent ตาม docs ต้องตรวจก่อนว่า engine ส่ง `agent.spawn` มาไหม · L5 `now` ในโค้ด pane ชนกับ atom นาฬิกา · L6 `LaneState` out/finished ให้ตรงกับ Failed/Done |
| 4 | ชื่อในโค้ด | `AgentRun.steps` → requests ฯลฯ ไม่แตะ key ของ atom (state ไม่หายตอน reload) |
| 5 | Design | preview: หัวกล่อง This turn / Earlier turns / Workflow run, tooltip ของ Main, แถว Subagents ใน band → เลือก → ทำ → ตรวจบน desktop |

### P1 — แก้ bug (2.20.x)

ตรวจโค้ดของ 2.20.0 เมื่อ 2026-10-13 (V1–V5 ของ review หลัง 2.14.1 และของค้างจาก 2.19/2.20) · V4e ("0 agents") แก้ไปแล้วทางอ้อม เพราะ Main ที่ไม่มี agent ไม่ตกไปอยู่ใน Earlier

| ID | งาน | รายละเอียด | ขนาด |
|---|---|---|---|
| N8 | `/clear` ไม่ล้าง `background` | `session.end` ล้างเกือบทุก atom ยกเว้น `background` · ต้องยืนยันก่อนว่า engine ฆ่า task เบื้องหลังตอน `/clear` ไหม ถ้าไม่ฆ่า การนับต่อก็ถูกแล้ว | S |

### P1b — ตรวจบน desktop (release ไปแล้วแต่ยังไม่ได้ยืนยัน)

- 2.20.0: `session.end` ยิงตอน `/clear` จริงไหม · หลัง compact `session.measure` เอา % เก่ามาทับค่าประมาณไหม
- 2.18.0: นับ background task ตอนกด Ctrl+B และตอน timeout
- 2.15.0: `wrap` ของ Text ในช่อง Asked to
- 2.20.1: ทำไมการอ่าน git user/Node บน desktop จึงช้ากว่า turn ทั้ง turn (`node` อาจเป็น shim ของ mise ซึ่งครั้งแรกใช้ ~2 วิ แต่ยังน้อยกว่า timeout 5 วิมาก) · ตอนนี้ตัวที่ช้าไม่ถ่วงส่วนอื่นแล้ว แต่ถ้า git user/Node ไม่ขึ้นเลย ให้จดเวลาของแต่ละ read

### P2 — ถัดไป (กลาง)

| ID | กลุ่ม | งาน | ขนาด | หมายเหตุ |
|---|---|---|---|---|
| V1 | Agents pane | contrast บนพื้น tint | S–M | NEW และ icon บน tile แก้แล้ว · ยังต่ำกว่า 4.5:1: ป้าย mood `m` บน `kl-skill` (Raised dark 4.25), mood failed (Raised dark 4.27, Flat dark 4.39), mood done (Flat light 4.35), ตัวนับใน chip MCP (Raised dark 4.12, Flat dark 4.31), `+added` (Flat light 4.41) · เพิ่ม test ที่วัดตัวหนังสือบนพื้น tint |
| V2 | Agents pane | ค่า CONTEXT ใน head ถูกตัด | S | การทับกับป้าย mood แก้แล้ว · ต่ำกว่า ~391 px ค่า `64k · 32%` ถูกตัด และที่ 240 px เหลือแค่ `…` ให้ใช้ `%` อย่างเดียวเมื่อค่าเต็มไม่พอดี (svg.ts:1500) |
| V3 | Agents pane | สิ่งที่เกิน budget หายเงียบ | S | แถว Earlier (register.tsx:771) และกล่องย่อยของ Viewing (:752–755) ไม่มีตัวนับ `+N` เหมือน lane · หัว Earlier นับ crew ทั้งหมดแม้วาดไม่ครบ |
| V5 | Agents pane | performance | S | `logAgentCall` เรียก update 2–3 ครั้งต่อ call (+2 ของ race) ให้รวมเป็นครั้งเดียว · จำกัดจำนวน Haiku ที่เรียกพร้อมกัน (ตอนนี้ agent ที่จบทุกตัวเรียกทันที) |
| L1 | Band · usage | เก็บ rate limit ล่าสุด | S | ข้อ 4 ของ review 2.20.0 · `readUsage` และ `session.measure` แทน usage ทั้งก้อน ถ้า response ไม่มี rate limit ค่า 5H/7D เดิมหายไป |
| R3 | Band · live strip | ต่อยอดการทำงานและการแสดงผล | M | ต้องกำหนด scope ก่อนเริ่ม (ยังไม่ชัดว่าจะเพิ่มอะไร) |
| L2 | โค้ด | ของค้างจาก 2.19.0 | S–M | รวมตัวสร้าง `<svg xmlns…>` ที่มีอยู่ 8 จุดใน svg.ts · หัวกลุ่ม settings ยังใช้ ✻/◈ (register.tsx:1235, 1263) |

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

- **2.20.1** skeleton ของแถว info ไม่ค้างข้างป้าย branch แล้ว (N1): เดิม `setUp` รอ `git config user.name` และ `node --version` ทั้งคู่ก่อนจะตั้งชื่อโฟลเดอร์และปิด skeleton ระหว่างนั้นการอ่าน branch ตอนจบ turn หรือรอบ 30 วิวาดป้าย branch ข้างแท่งเทาโดยไม่มีชื่อโฟลเดอร์ · ตอนนี้ชื่อโฟลเดอร์ขึ้นทันทีจาก `cwd`, การอ่าน branch เป็นตัวปิด skeleton, git user และ Node ขึ้นทีละตัวเมื่ออ่านได้ (ตัวที่ช้าถ่วงแค่ตัวเอง) และไม่แทน `env` ทั้งก้อนจนลบ branch ที่อ่านไว้แล้ว · ยังไม่รู้ว่าทำไมบน desktop การอ่านนี้ช้ากว่าทั้ง turn · แก้จาก review ด้วย (N2–N7): `/clear` หรือ compact ที่อ่าน usage ไม่ได้ไม่ค้าง % เก่าอีก · สรุปของ Haiku ที่รออยู่ตอน reload ถูกขอใหม่ ไม่ค้าง pending · agent ที่จบไม่มี call ค้าง Running… · ผล test ของ agent อ่าน stderr ด้วยเหมือน race · agent ของ workflow ที่ถูกปลุกอยู่ใน crew ของ workflow เดิม · ภาพ overview มี key ตาม crew (ไม่มี test เพราะ test API มองไม่เห็น key ของ Svg) · คำตอบที่มาหลัง reload ไม่เป็น rejection ที่ไม่มีใครจับ · Main ใน pane กับ band พูดตรงกัน (เจอตอนทดสอบบน desktop): turn ของ Main ที่จบแล้วแต่ agent ใน crew ยังทำงานแสดงเป็น `Waiting on N` / `รอ agent อีก N ตัว ⏳` ไม่มี ✓ และแถบใน timeline ยังเดิน (เดิม pane ขึ้น "งานเสร็จ ส่งรายงานแล้ว" ✓ ขณะที่ band ขึ้น Waiting on 1) · หัว race กับกล่อง Now นับเฉพาะ agent ด้วยคำเดียวกัน `N running · N done` (เดิม band ขึ้น `1 agent` ที่หมายถึงตัวที่ทำงาน ส่วน pane นับ Main รวมใน done)
- **2.20.0** ค่า context ตอนเริ่ม session ใหม่, หลัง `/compact` และ `/clear` (review: ทำข้อ 1–3, ข้อ 4 เก็บ rate limit ล่าสุดยังไม่ทำ): `readUsage` ใช้ค่าประมาณในเครื่องจาก `$.session.usage({ breakdown: 'summary' })` (ไม่ส่ง request) เมื่อยังไม่มีค่าจาก response หรือค่าเก่าไปแล้ว แสดงเป็น `~18k / 200k` จนกว่า `session.measure` จะส่งค่าจริงมา ไม่มีค่าประมาณก็ไม่แสดง context (ไม่โชว์ % เก่าค้าง) · hook `session.compact` (main loop เท่านั้น ข้าม `precompute`) · ย้ายการล้าง state ตอน `/clear` จาก `classic.SessionStart` ซึ่ง desktop ไม่ยิง ไปที่ `session.end` (reason `clear`/`resume`) · ยังไม่ได้ตรวจบน desktop: `session.end` ยิงตอน `/clear` จริงไหม, `session.measure` หลัง compact เอา % เก่ามาทับไหม
- **2.19.0** เก็บงานทั้ง mod (review 3 ด้าน: ไอคอน, reuse, style; preview 4 รอบ): สี pastel ชุดเดียว `PALETTE` แบบ C5 (พื้น/สัญลักษณ์/เส้น ต่อสี, light และ dark ผ่าน CSS variable, สัญลักษณ์บนพื้น ≥ 5:1 มี test) ใช้กับไอคอน call, badge ✓/✗/✋, stripe, แถบ, timeline, tint/กะพริบตอนจบ · ไอคอน call เป็น Lucide แบบ I2 ชุดเดียวกับแชต (หนังสือ, แว่นขยาย, ดินสอ, terminal, flask, globe, plug, หลอดไฟ) call ที่ล้มคงไอคอนชนิดบนพื้นแดง · done เป็นเขียว (เดิมเขียวน้ำทะเลซ้ำ read) · คำอังกฤษขึ้นต้นตัวใหญ่ · เวลาใน race เป็น `1m 4s` · agent ที่ถูกหยุดพับเป็น ✋ ใน race และแถว crew นับแยกจาก failed · lane ของ Main ชื่อ Main (เอา badge main ออก) · มุมการ์ดใน pane 8 · lane ใน pane กะพริบตอนจบ · แชต: edit สีคราม, command ที่สำเร็จไอคอนเทา · bug: `1 calls`, แกนเวลา `0s`, `+N more`, ตัวอย่าง edit ใน settings, สรุป Earlier `✓ 3 · ✗ 2 · ✋ 1`, ชื่อ step ในแชตไม่ตัดกลาง emoji · เก็บงาน: รวม helper ซ้ำ (clock, plural, basename, hhmm, quietFor, justEnded, hatted, widthOf), ลบไอคอน pixel, CSS pop/shake, stroke eye, ตัววัด sans ตัวที่สอง · ยังไม่ทำ: refactor ตัวห่อ svg/การ์ด, หัวกลุ่ม settings ✻/◈
- **2.18.0** งานเบื้องหลังและแถวรอยการทำงาน (preview 2 รอบ): ใต้ Clawd ขึ้น `● N running` จุดกะพริบ เมื่อเป็นตาของผู้ใช้แต่ยังมี shell/Monitor ที่ Main เริ่มไว้รันอยู่ (นับจาก `backgroundTaskId` ของ Bash, `taskId` ของ Monitor; ลดเมื่อ `TaskStop` หรือ task notification บอกสถานะจบ; ไม่นับ agent เพราะอยู่ใน race แล้ว) · พบว่า desktop ไม่ส่ง `classic.*` event ให้ hooks module เลย จึงใช้ `classic.Stop` ไม่ได้ (ทดสอบด้วย logger `*`) · แถว live strip แบบ B: ซ้ายเป็นไอคอน call ที่กำลังรัน (กะพริบ) ชื่อ และเวลาของ call นั้น หรือจุดกะพริบ `thinking` ระหว่าง call; ขวาเป็นรอยไอคอน call ของ turn ตามสีชนิด (ล้มเป็นแดง, เกิน 16 ขึ้น `+N`) แล้วบรรทัด `+/−` และผล test · เวลาของ turn อยู่ใต้ Clawd ที่เดียว ไม่ซ้ำใน live strip · ข้อจำกัด: งานที่เริ่มก่อน reload ไม่ถูกนับ, Ctrl+B/timeout ยังไม่ได้ทดสอบบน desktop
- **2.17.0** ไอคอนจบงาน (preview 2 รอบ): race แบบ A: agent ที่เพิ่งล้มล้มลงสีเทาบนแถวกะพริบแดงอ่อน 5 วิ (ไม่มี confetti) แล้วพับเป็น ✗ แดง ชื่อสีปกติเหมือน Done, `Failed` กับ stripe ยังแดง; ตัวที่ถูกหยุดคงเดิม · agents pane แบบ P1: lane ที่จบแล้วมี badge กลมที่มุม Clawd ✓ เขียว / ✗ แดง / ✋ เทา (ตรงกับ timeline) ขอบสีการ์ด, 3 วิแรก lane เป็นสีเขียว/แดงอ่อนและ Clawd ที่ล้มจะล้มแทนท่ามึน · แก้ bug: agent ที่เพิ่งล้มใน race กระโดดเหมือนตัวที่เสร็จ · ข้อจำกัด: lane ใน pane ไม่กะพริบ (ยังไม่มี CSS flash ใน pane) และสั้นกว่า race (3 วิ vs 5 วิ)
- **2.16.1** race: header แยกนับ agent ที่ done / failed / stopped (เดิมนับตัวที่ล้มและถูกหยุดรวมเป็น done) ตัดคำถ้ายาวเกินที่ · agent ที่ถูกหยุดขึ้น `Stopped` สีเทา Clawd ยืนจาง (เดิมขึ้น `Failed` สีแดง ไม่ตรงกับ pane) · จุด `·` หลังจำนวน agent ไม่ทับตัวหนาแล้ว
- **2.16.0** race ใน band รอบใหม่ (preview 2 รอบ, เลือก B + R1–R9 + F1): แถวละ 22px แทนลู่วิ่ง (3 agents สูง 118px จาก 174px) · ไม่มี agent ไม่แสดง race ให้ live strip กลับมา (R1) · แก้ bug: lane ที่รวมหลายตัว (`Explore ×3`) ได้ที่ก่อน ไม่ถูกซ่อนไปท้าย (R2) · header `3 agents · 1 done` + ✗ + เวลา, ตัด ✓ รวม, `+N more · open Agents for all` (R3) · แถวเหลือแค่ ✗ (R4) · `n/total` + แถบเล็กเฉพาะตัวที่มีแผน (R5) · `quiet 47s` สีเหลือง Clawd หลับ (R6) · stripe สีตาม mood เหมือน pane (R7) · Main แถวเดียว `waiting on N` หมวกกัปตัน (R8) · เพิ่งจบ 5 วิ: กระโดด + confetti + แถวกะพริบเขียว `Done! 🎉` แล้วพับเป็น ✓ (R9/F1) · ตัดลู่วิ่ง รอยเท้า ธง OUCH/OUT · ข้อจำกัด: background agent ตัวสุดท้ายที่จบตอน Main ไม่ทำงาน race หายทันที ไม่เห็น confetti
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
