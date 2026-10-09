// Copied into each mod on purpose (docs/PLAN.md §7): keep every copy identical.
// Pure on purpose too: the engine never follows `$` across an import, so each mod reads
// the setting and the locale in its own hooks module and hands them in.

export type Lang = 'th' | 'en'

const isThai = (v: unknown): boolean => typeof v === 'string' && /^(th|thai|ไทย)/i.test(v.trim())

// The mod's `language` option, else Claude Code's `language` setting, else the locale; English otherwise.
export function pickLang(option: unknown, setting: unknown, locale: unknown): Lang {
  if (option === 'th' || option === 'en') return option
  if (typeof setting === 'string' && setting.trim()) return isThai(setting) ? 'th' : 'en'
  return isThai(locale) ? 'th' : 'en'
}
