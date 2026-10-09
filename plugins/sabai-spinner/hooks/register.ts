import type { Register } from 'claude-code'

import { pickLang, type Lang } from './i18n'
import { wordFor } from './words'

// Module state is fine here: session.start and turn.start set it again after a reload.
let lang: Lang = 'en'
let turnId = ''

export const register: Register = (on, options) => {
  if (options.words === 'off') return
  lang = pickLang(options.words, undefined, undefined)

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    let setting: unknown
    try {
      setting = (await $.settings.read()).language
    } catch {
      // No settings: fall through to the locale.
    }
    const locale = (await $.env.get('LC_ALL')) || (await $.env.get('LC_MESSAGES')) || (await $.env.get('LANG'))
    lang = pickLang(options.words, setting, locale)
    return started
  })

  on('turn.start', ($, e, next) => {
    turnId = e.turnId
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    // The desktop's word names the step being run; only its generic "Working" is ours to replace.
    if (e.surface === 'desktop' && e.props.word !== 'Working') return next(e)
    const set = e.surface !== 'desktop' ? 'casual' : e.props.mode === 'tool-input' ? 'tool-use' : e.props.mode
    return next({ ...e, props: { ...e.props, word: wordFor(lang, set, `${turnId}:${e.requestId}`) } })
  })
}
