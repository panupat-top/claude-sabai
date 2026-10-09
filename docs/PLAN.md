# Claude Mods — Feature Plan (draft v0)

> สถานะ: v4 — Phase 1 (`sabai-spinner`) เสร็จ (2026-10-10), ถัดไป Phase 2 `sabai-band`
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
3. **Phase 2 — `band`**: B3 → B1 → B2 (ง่ายไปยาก) → verify: test ต่อส่วน + ลองใน Code tab
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
