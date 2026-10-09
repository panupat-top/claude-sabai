import type { Lang } from './i18n'

export type WordSet = 'thinking' | 'requesting' | 'responding' | 'tool-use' | 'casual'

export const WORDS: Record<Lang, Record<WordSet, readonly string[]>> = {
  th: {
    thinking: ['ครุ่นคิด', 'ไตร่ตรอง', 'ขบคิด', 'ชั่งใจ', 'ตกผลึก', 'เรียบเรียงความคิด'],
    requesting: ['ต่อสาย', 'ส่งเรื่อง', 'รอคิว', 'เคาะประตู'],
    responding: ['บรรจงเขียน', 'ปั้นคำ', 'เรียบเรียง', 'ร่ายยาว'],
    'tool-use': ['ลงมือ', 'ไล่เช็ค', 'พลิกแฟ้ม', 'ขุดคุ้ย', 'ประกอบร่าง'],
    casual: [
      'ชิลๆ', 'ค่อยเป็นค่อยไป', 'ชงชาไทย', 'จิบกาแฟเย็น', 'ตำส้มตำ', 'ปิ้งหมู', 'ผัดกะเพรา',
      'เคี่ยวต้มยำ', 'นวดแป้ง', 'หุงข้าว', 'รดน้ำต้นไม้', 'นั่งสมาธิ', 'เสกคาถา',
    ],
  },
  en: {
    thinking: ['Mulling', 'Pondering', 'Weighing it up', 'Connecting dots'],
    requesting: ['Dialing in', 'Knocking', 'Queueing up'],
    responding: ['Composing', 'Wordsmithing', 'Putting it down'],
    'tool-use': ['Rolling up sleeves', 'Digging in', 'Flipping files', 'Assembling'],
    casual: [
      'Taking it easy', 'Steeping cha yen', 'Pounding som tam', 'Grilling moo ping',
      'Stir-frying krapow', 'Simmering tom yum', 'Kneading dough', 'Watering plants',
    ],
  },
}

// The same seed always picks the same word, so the spinner keeps its word while it redraws.
export function wordFor(lang: Lang, set: WordSet, seed: string): string {
  const words = WORDS[lang][set]
  let hash = 5381
  for (let i = 0; i < seed.length; i++) hash = (hash * 33 + seed.charCodeAt(i)) >>> 0
  return words[hash % words.length]!
}
