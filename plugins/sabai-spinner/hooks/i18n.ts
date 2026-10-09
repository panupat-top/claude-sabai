import type { EngineInterface } from 'claude-code'

// Copied into each mod on purpose (docs/PLAN.md §7): keep every copy identical.

export type Lang = 'th' | 'en'

const isThai = (v: unknown): boolean => typeof v === 'string' && /^(th|thai|ไทย)/i.test(v.trim())

// The mod's `language` option, else Claude Code's `language` setting, else the locale; English otherwise.
export function pickLang(option: unknown, setting: unknown, locale: unknown): Lang {
  if (option === 'th' || option === 'en') return option
  if (typeof setting === 'string' && setting.trim()) return isThai(setting) ? 'th' : 'en'
  return isThai(locale) ? 'th' : 'en'
}

export async function detectLang($: EngineInterface, option: unknown): Promise<Lang> {
  let setting: unknown
  try {
    setting = (await $.settings.read()).language
  } catch {
    // No settings: fall through to the locale.
  }
  const locale = (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))
  return pickLang(option, setting, locale)
}
