# Claude Mods — Feature Plan (draft v0)

> สถานะ: v7 — Phase 2 (`sabai-band`) pixel redesign รอลองใน Code tab (2026-10-10)
> อ้างอิง: [hellosverre/claude-skins](https://github.com/hellosverre/claude-skins) ·
> [JohnnyVizz/claude-kit › savvy-progress](https://github.com/JohnnyVizz/claude-kit/tree/main/plugins/savvy-progress) ·
> [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree) (ทั้งหมด MIT)

## 1. สิ่งที่ได้จากการอ่าน repo อ้างอิง

ทั้ง 3 ตัวเป็น **Claude Code mod** (function-hooks plugin, ต้องใช้ Claude Code ≥ 2.1.287) โครงเดียวกัน:

```
.claude-plugin/plugin.json      # name, version, "types"
hooks/hooks.json                # { "modules": ["./register.tsx"] }
hooks/register.tsx              # export const register: Register = (on) => { ... }
types/index.d.ts                # contract ของ $.state
tests/*.test.ts(x)              # claude plugin test .
```

| Repo | ขนาด | ทำอะไร | Engine API หลักที่ใช้ |
|---|---|---|---|
| claude-skins | ~4.8k LOC | วาด transcript ใหม่ทั้งหมด: tool row + icon/เวลา, diff card, table/code card, spinner, usage band, 7 themes, `/skin`, ให้ Claude ออกแบบ skin ผ่าน tool `design` | `ui.render` (AssistantMessage, ToolUse, ToolResult, Spinner, AbovePrompt, UserMessage), `command.*`, `store.*`, `tool.register`, `http.fetch` (update check) |
| savvy-progress | ~1.1k LOC | progress bar เหนือ prompt + pane รายการ subagent (model, effort, context, cost, เวลา) + MCP tools `progress`/`step` ให้ agent รายงานความคืบหน้า | `ui.render` (AbovePrompt, Pane), `tool.register`, `agent.spawn`, `turn.*`, `session.usage` |
| filetree | ~3.1k LOC | file tree pane ฝั่งขวา: git status +N/−N, highlight ไฟล์ที่ Claude อ่าน/เขียน, search, ส่งไฟล์ที่เลือกเข้า prompt, git ops status | `ui.render` (Pane), `tool.call` (ดัก Read/Edit/Bash), `prompt.submit`, `process.run` (git), `fs.*`, `classic.FileChanged/CwdChanged` |

**ข้อจำกัดที่ต้องรู้ก่อนเลือก**
- Pane ต้องเป็น fullscreen layout (`/tui fullscreen`) และ terminal กว้างพอ (filetree ระบุ ≥ 110 cols; pane ที่เปิดเองอัตโนมัติต้อง ≥ 144 cols)
- Surface ต่างกัน: `terminal` / `desktop` / `vscode` / `mobile` — skins วาดบน desktop สวยกว่า terminal มาก (หลายส่วน terminal ใช้ของเดิม)
- Mod API ยังใหม่ ยิ่ง override component เยอะ (แบบ skins) ยิ่งเสี่ยงพังเมื่อ Claude Code อัปเดต
- Mod ไม่โหลดใน WSL session ของ Desktop app

## 2. Feature catalog (ให้คัดเลือก)

ระดับความยาก: S = < 150 LOC · M = 150–500 · L = > 500

### A. Look & Feel (จาก claude-skins)
| ID | Feature | ขนาด | หมายเหตุ |
|---|---|---|---|
| A1 | Theme core: palette + light/dark ตาม theme ของ Claude Code, `/skin <name>` | M | ฐานของ A2–A6 |
| A2 | Tool row: icon ตามชนิด tool + เวลาที่ใช้ + บรรทัดที่เปลี่ยน | M | |
| A3 | Diff card ของ Edit (`+N −M`, เลขบรรทัด) | M | desktop เป็นหลัก |
| A4 | Table / code block card + ปุ่ม Copy | L | desktop เป็นหลัก, เสี่ยงสูงสุด |
| A5 | Spinner คำ/animation ของตัวเอง (เช่นคำภาษาไทย) | S | ได้ผลเยอะต่อโค้ดน้อย |
| A6 | Claude ออกแบบ theme ให้ผ่าน tool `design` | M | ต้องมี A1 |

### B. Band เหนือ prompt / status
| ID | Feature | ขนาด | หมายเหตุ |
|---|---|---|---|
| B1 | Usage band: context % + plan limit + ปุ่ม Compact + เตือนที่ 70% | M | จาก skins |
| B2 | Progress bar ของงาน/plan (phase, tasks done/total) | M | จาก savvy-progress |
| B3 | Status line: branch, cost สะสม, เวลาของ turn | S | `$.ui.status` |

### C. Panes
| ID | Feature | ขนาด | หมายเหตุ |
|---|---|---|---|
| C1 | File tree + git status + highlight ไฟล์ที่ Claude แตะ | L | จาก filetree; ใช้ได้เฉพาะ fullscreen |
| C2 | Agents panel: subagent ที่รัน/เสร็จ + model, context, cost, เวลา | M | จาก savvy-progress |
| C3 | เลือกไฟล์ใน tree → แนบเข้า prompt, `@path` → reveal ใน tree | S | ต้องมี C1 |

### D. Behaviour hooks (ไม่มีใน repo อ้างอิง — ข้อเสนอเพิ่ม)
| ID | Feature | ขนาด | หมายเหตุ |
|---|---|---|---|
| D1 | Guard: deny คำสั่งอันตราย (`rm -rf /`, `git push --force` ไป main, อ่าน `.env`) | S | `tool.call` → `{ deny }` |
| D2 | แจ้งเตือนเมื่อ turn ยาวจบ: toast + เสียง | S | `turn.complete`, `$.audio.play` |
| D3 | Cost/token tracker ต่อ session (ประมาณการ) | S | ใช้ร่วมกับ B3/C2 |

### E. Infrastructure (ทำครั้งเดียว ใช้ทุก mod)
| ID | Feature | ขนาด | หมายเหตุ |
|---|---|---|---|
| E1 | Repo เป็น marketplace (`.claude-plugin/marketplace.json`) | S | **จำเป็น** |
| E2 | `claude plugin validate` + `claude plugin test` + pre-commit + GitHub Actions | S | **จำเป็น** |
| E3 | Settings ผ่าน `/config` (userConfig) | S | |
| E4 | i18n th/en (ตาม `language` setting) | S | savvy-progress มี en/ru เป็นตัวอย่าง |
| E5 | Daily update check → toast | S | ต้องมี network call 1 จุด |

## 3. ทางเลือกด้านโครงสร้าง

| ทางเลือก | ข้อดี | ข้อเสีย |
|---|---|---|
| **Multi-mod marketplace** (แบบ claude-kit): `plugins/<mod>/` แยกกัน | เปิด/ปิดทีละตัว, พังตัวเดียวไม่ลากตัวอื่น, เริ่มเล็กได้ | shared code (theme, i18n) ต้อง copy หรือทำ dependency |
| **Single mod** (แบบ skins/filetree) | share theme/state ง่าย | โตเร็ว, ปิดบางส่วนต้องทำ toggle เอง |

**ข้อแนะนำ:** multi-mod marketplace — repo นี้เป็น marketplace, แต่ละกลุ่ม feature เป็น mod ของตัวเอง

## 4. การตัดสินใจ (2026-10-10)

| เรื่อง | เลือก |
|---|---|
| โครงสร้าง | Multi-mod marketplace: `plugins/<mod>/` |
| Surface หลัก | Desktop Code tab — terminal แค่ต้องไม่พัง (fallback เป็นของเดิม) |
| MVP | A5, B1, B2, B3 |
| ภาษา | th/en ตาม `language` setting ของ Claude Code, ไม่ตั้ง → en |
| ชื่อ marketplace | `claude-sabai` · mod ใช้ prefix `sabai-` (`sabai-spinner`, `sabai-band`) กันชื่อชนกับ plugin อื่น |
| i18n helper | copy `hooks/i18n.ts` ไว้ในแต่ละ mod ทุก copy ต้องเหมือนกัน เป็น pure function (`pickLang`) เพราะ engine ไม่ยอมให้ส่ง `$` ข้าม import การอ่าน setting และ locale จึงอยู่ใน `register.ts` ของแต่ละ mod |

## 5. MVP ที่ปรับปรุงแล้ว

แบ่งเป็น 2 mod เพราะ B1/B2/B3 อยู่ตำแหน่งเดียวกัน (เหนือ/ใต้ prompt) ถ้าแยก mod จะวาด `AbovePrompt` ซ้อนกัน

### Mod 1 — `sabai-spinner` (A5)
- `ui.render` บน `Spinner`: คำหมุนเวียนของเราเอง (ชุดไทย/อังกฤษ) แทนคำเดิม
- ⚠️ บน desktop ค่า `word` คือคำบอกว่า step ทำอะไรอยู่ (`Creating notes.md`) หรือเป็น `Working` เมื่อไม่มีคำ → **แทนเฉพาะตอนที่เป็น `Working`** ส่วนคำบอก step เก็บไว้ตามเดิม; บน terminal แทนทุกครั้ง
- desktop: เลือกชุดคำตาม `mode` (`thinking` / `requesting` / `responding` / `tool-use`) · terminal: ใช้ชุด "สบายๆ" (แทนคำแนว `Sauteing` ของเดิม)
- คำคงที่ตลอด turn (seed = `turnId:requestId`) ไม่กระพริบเปลี่ยนตอน redraw
- ตั้งค่าใน `/config`: ชุดคำ `auto | th | en | off`
- verify: test ว่าเลือกชุดคำตาม language ถูก + render ไม่ throw ทั้ง desktop/terminal

### Mod 2 — `sabai-band` (B1 + B2 + B3)
| ส่วน | ที่มาของข้อมูล | ปรับปรุงจากต้นฉบับ |
|---|---|---|
| B1 Usage band: context %, rate-limit windows, ปุ่ม Compact, เตือน ≥ 70% | `$.session.usage()` → `{ context, rateLimits, cost }`, ปุ่มเรียก `$.session.compact()` | cost มาจาก engine จริง ไม่ต้องมีตารางราคาเอง (savvy-progress ใช้ตาราง `PRICES` ประมาณการ) → D3 ได้ฟรี |
| B2 Progress bar: tasks done/total + task ปัจจุบัน | ดัก `tool.call` ของ `TaskCreate` / `TaskUpdate` / `TodoWrite` ที่ Claude ใช้อยู่แล้ว | **ไม่ต้องเพิ่ม MCP tool / skill** ให้ model รายงานเอง (savvy-progress ต้องมี `progress`/`step` tool + savvy-flow skill) |
| B3 Status line: branch · cost · เวลาของ turn | `$.ui.status(text)`, `turn.start`/`turn.complete`, `git` ผ่าน `$.process.run` | — |

- Band ซ่อนตัวเองเมื่อไม่มีอะไรจะแสดง (ยังไม่มี task, context < threshold)
- verify: test render band ทั้ง desktop/terminal, test reducer ของ task events, test ข้อความ th/en

### ไม่อยู่ใน MVP (เก็บไว้)
A1–A4, A6 (theme) · C1–C3 (panes) · D1 guard · D2 แจ้งเตือน turn จบ · E5 update check

## 6. Roadmap

1. ✅ **Phase 0 — Skeleton** (2026-10-10): E1 marketplace + E2 validate/test/CI + mod เปล่า → verify: `claude plugin validate` / `claude plugin test` ผ่าน, install จาก marketplace ได้ — _ยังไม่ได้ลอง install จริง_
2. ✅ **Phase 1 — `sabai-spinner`** (โค้ด + 8 tests + `tsc` ผ่าน, ยืนยันคำไทยใน Code tab แล้ว 2026-10-10) (เล็กสุด ใช้พิสูจน์ pipeline + i18n helper) → verify: test + ลองใน Code tab
3. 🟡 **Phase 2 — `sabai-band`** (14 tests + `tsc` ผ่าน, รอลองจริง): B3 → B1 → B2 → verify: test ต่อส่วน + ลองใน Code tab
   - usage มาจาก event `session.measure` (engine ส่งเมื่อค่าเปลี่ยน ไม่ต้อง poll) · เวลาของ turn มาจาก `turn.complete.durationMs` (เฉพาะ agent หลัก)
   - แถว usage แสดงตลอดเมื่อมีค่าแล้ว (context %, 5 ชม., 7 วัน) — ปุ่มย่อบริบทขึ้นเมื่อ ≥ 70% และไม่ได้อยู่กลาง turn
   - ปุ่มย่อบริบทเรียก `/compact` ผ่าน timer เพราะงานที่เริ่มจาก press ถูกยกเลิกเมื่อ press จบ (บทเรียนจาก skins)
   - วาดของ mod อื่นใน band ต่อท้ายของเรา (`next(e)`) ไม่ทับ
   - progress bar หายเมื่อทุก task เสร็จ · ล้าง task เมื่อ `/clear`, resume, fork
   - **v6 (ตาม feedback):** UI ผสมต้นฉบับ — desktop: progress bar แบบ dithered + pill `n/total` (savvy-progress) และวงแหวน context / 5h / 7d (claude-skins) วาดเป็น SVG แถวละชิ้นเพราะ desktop ตัด element พี่น้องขึ้นบรรทัดใหม่; terminal: block meter ข้อความ · ใช้ภาษาอังกฤษอย่างเดียว (ตัด i18n ออกจาก band) · ย้าย branch · cost · last turn เข้า band เพราะ `$.ui.status` ไม่แสดงใน Code tab · ปุ่ม Compact แสดงตลอด (จาง) และเป็นปุ่มหลัก "Compact now" ที่ ≥ 70% ตาม skins · ปุ่ม ✕ ปิด progress bar
   - **v7 (ตาม feedback):** ยึดสไตล์ savvy-progress ทั้ง band — meter แบบ dithered pixel 4 ตัว (Context · 5H Limit · 7D All · 7D <model>) ในตาราง 2×2 พร้อม countdown `↻ 2h 49m` (tick ทุก 30 วิ) · sprite pixel art มี animation: ปูเดิน (tasks), ชิป LED (context), นาฬิกาทราย (5H), ปฏิทิน (7D), ดาว (model) · ตัด branch/cost/last turn ออก · ปุ่มแบบเดียวกันหมด (plain + glyph): ◆ Compact · ⌫ Clear (กดสองครั้งภายใน 4 วิ) · ↶ Rewind · ⏵ Resume — แสดงเฉพาะคำสั่งที่ session มี (`$.command.list`) และซ่อนระหว่าง turn · แยก group: tasks / usage / actions ด้วย rowGap
   - 7D <model> อ่านจาก cache ของ statusline (`$TMPDIR/claude-statusline-usage.json`, `weekly_scoped`) — mod ไม่อ่าน OAuth token เอง ไม่มีไฟล์ = ซ่อน meter
   - **v8 (ตาม feedback):** ตัดปุ่มออกทั้งหมด (Compact, Clear, Rewind, Resume, ✕) · context แสดงเป็น `434.5k / 1M (43%)` จาก `context.tokens` / `context.window`
   - **v9 (เลือก layout D แบบปรับ):** meter เป็นการ์ด 2 บรรทัด — บรรทัดแรก: sprite + ป้ายชิดซ้าย, รายละเอียดชิดขวา (`434.5k / 1M` หรือ `↻ 2h 49m`); บรรทัดสอง: pixel bar + % ชิดขวา · 4 ใบต่อแถว (≥ 720px), 2 ใบ (≥ 400px), 1 ใบเมื่อแคบกว่านั้น · การ์ดขยายเต็มความกว้างเมื่อมี meter น้อยกว่า 4
   - **v10:** icon ของแถว task เปลี่ยนจากปูเป็น Pixel Clawd (รูปทรงเดียวกับ savvy-progress / DockCrab) — `run` (เดิน ขาก้าว ตัวโยก) เมื่อมี task in progress หรือ turn กำลังทำงาน, `idle` (ยืนกะพริบตา) เมื่อรอ
   - **v11 (compact + full width):** แถว task กับการ์ดรวมเป็น SVG เดียว ระยะห่าง 8px · การ์ดสูง 44px · ความกว้าง = `bodyColumns × 8.25` (ไม่หัก 48 ซ้ำ เพราะ `bodyColumns` หัก collapse mark ไว้แล้ว, เพดาน 4096) และไม่ส่ง `width` ให้ Svg — surface ย่อ markup ที่กว้างกว่า slot ให้พอดี จึงเต็มความกว้างเสมอ
   - **v12 (type pass):** scale ตัวอักษร 3 ระดับ — title 13 sans 500 · ค่า/ตัวเลข 11.5 mono (amount 600, % 700, countdown 500) · ป้าย 10 mono caps 600 + tracking · สีตัวอักษรแยก light/dark ทุกสีผ่าน 4.5:1 บนการ์ด (มี test) · pill ใช้ clay เข้ม `#b5532f` ให้ตัวขาวผ่าน 4.5:1 · icon การ์ดอยู่ในกรอบ 18×16 (นาฬิกาทรายเหลือ 8 แถว)
   - **v13:** ตัด icon ของ 5H / 7D All / 7D <model> ออก (ป้ายชิดซ้ายของการ์ด) — เหลือ sprite แค่ Clawd กับชิปของ Context
   - **v14:** แถวชิปใต้แถว task: BRANCH (`main ±3` = ไฟล์ที่ยังไม่ commit) · GIT (`user.name`) · NODE · CLAUDE (version ของ Claude Code) · MODEL — branch/changes/model รีเฟรชเมื่อ turn ของ agent หลักจบและทุก 30 วิ, ที่เหลืออ่านครั้งเดียวตอน session start · ชิปที่ไม่พอที่จะถูกตัดจากท้าย
   - **v15:** แถวชิปย้ายขึ้นเป็นบรรทัดแรก · ป้ายข้อความเปลี่ยนเป็นไอคอนจริง (Octicons `file-directory-fill` / `git-branch`, Simple Icons โลโก้ Git `#F05032` / Node.js `#5FA04E`) · ซ้าย = directory · git user · branch ±changes, ขวา = node · ตัด CLAUDE / MODEL ออก
   - **v16 skins:** `/sabai-skin [name]` (Code tab ไม่มี `/config`) จำค่าใน `$.store` ข้าม session · `auto` (เดิม ตาม OS) + Catppuccin Latte / Frappé / Macchiato / Mocha, Dracula, Tokyo Night, Nord, Gruvbox Dark, Rosé Pine · เปลี่ยน: พื้นหลัง band (inset 10px), พื้นการ์ด/ชิป, ราง bar, สีตัวอักษร, สี meter, เตือน/แดง, progress bar + pill, สีใน terminal · สีตัวอักษรที่ไม่ถึง 4.5:1 ถูกปรับเฉดอัตโนมัติ (`readable`) และมี test ครอบทุกธีม · ไม่เปลี่ยน: Clawd (ส้ม Claude), โลโก้ Git/Node (สีแบรนด์), ธีมทั้งแอปของ Claude Code
   - 5H / 7D All: ใช้ค่าของ engine ก่อน ถ้า engine ยังไม่มี (session ใหม่หรือ resume ก่อน response แรก) ใช้ `session` / `weekly_all` จาก cache เดียวกัน
   - บทเรียน engine: ตาราง element ของ terminal มี `Svg` แต่ใช้ไม่ได้ ต้องแยกด้วย `e.surface` · `Svg` ต้องกว้าง/สูง > 0 และไม่เกิน 4096 px
4. **Phase 3** — เลือกจาก backlog ข้อ 5

## 7. คำ spinner (อนุมัติ 2026-10-10 · อยู่ใน `plugins/sabai-spinner/hooks/words.ts`)

กติกา: สั้น (≤ 3 คำ) อ่านแล้วรู้ว่ายังทำงานอยู่ engine จะต่อท้ายด้วย `…` ให้เอง

| mode | ไทย | English |
|---|---|---|
| `thinking` | ครุ่นคิด · ไตร่ตรอง · ขบคิด · ชั่งใจ · ตกผลึก · เรียบเรียงความคิด | Mulling · Pondering · Weighing it up · Connecting dots |
| `requesting` | ต่อสาย · ส่งเรื่อง · รอคิว · เคาะประตู | Dialing in · Knocking · Queueing up |
| `responding` | บรรจงเขียน · ปั้นคำ · เรียบเรียง · ร่ายยาว | Composing · Wordsmithing · Putting it down |
| `tool-use` | ลงมือ · ไล่เช็ค · พลิกแฟ้ม · ขุดคุ้ย · ประกอบร่าง | Rolling up sleeves · Digging in · Flipping files · Assembling |
| สบายๆ (ทั่วไป / terminal) | ชิลๆ · ค่อยเป็นค่อยไป · ชงชาไทย · จิบกาแฟเย็น · ตำส้มตำ · ปิ้งหมู · ผัดกะเพรา · เคี่ยวต้มยำ · นวดแป้ง · หุงข้าว · รดน้ำต้นไม้ · นั่งสมาธิ · เสกคาถา | Taking it easy · Steeping cha yen · Pounding som tam · Grilling moo ping · Stir-frying krapow · Simmering tom yum · Kneading dough · Watering plants |

ยังไม่ทำใน MVP: คำของ `TurnDuration` (`Baked for 3s`) เพราะเป็น terminal อย่างเดียว และประโยค `<word> for 3s` อ่านเป็นภาษาไทยไม่ลื่น

## 8. คำถามที่ยังค้าง

- (ไม่มี)
