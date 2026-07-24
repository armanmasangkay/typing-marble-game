import { POWERUP_CHANCE } from './constants.js'

// Common English words of varying length. Kept simple and family-friendly.
export const WORDS = [
  'time', 'year', 'people', 'way', 'day', 'man', 'thing', 'woman', 'life', 'child',
  'world', 'school', 'state', 'family', 'student', 'group', 'country', 'problem', 'hand', 'part',
  'place', 'case', 'week', 'company', 'system', 'program', 'question', 'work', 'number', 'night',
  'point', 'home', 'water', 'room', 'mother', 'area', 'money', 'story', 'fact', 'month',
  'lot', 'right', 'study', 'book', 'eye', 'job', 'word', 'business', 'issue', 'side',
  'kind', 'head', 'house', 'service', 'friend', 'father', 'power', 'hour', 'game', 'line',
  'end', 'member', 'law', 'car', 'city', 'community', 'name', 'president', 'team', 'minute',
  'idea', 'body', 'information', 'back', 'parent', 'face', 'level', 'office', 'door', 'health',
  'person', 'art', 'war', 'history', 'party', 'result', 'change', 'morning', 'reason', 'research',
  'girl', 'guy', 'moment', 'air', 'teacher', 'force', 'education', 'foot', 'boy', 'age',
  'quick', 'brown', 'jumps', 'over', 'lazy', 'happy', 'green', 'light', 'music', 'dream',
  'ocean', 'mountain', 'coffee', 'planet', 'garden', 'window', 'winter', 'summer', 'orange', 'purple',
  'keyboard', 'monster', 'rocket', 'dragon', 'castle', 'thunder', 'shadow', 'crystal', 'forest', 'river',
]

// Distinct-feeling words reserved for power-ups so they read as "special".
export const POWERUP_WORDS = [
  'clear', 'boost', 'shield', 'power', 'nova', 'flash', 'purge', 'reset',
  'cleanse', 'blast', 'wipe', 'surge', 'zap', 'break', 'burst', 'sweep',
]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Returns the next word to type: { text, powerup }.
export function nextWord() {
  if (Math.random() < POWERUP_CHANCE) {
    return { text: pick(POWERUP_WORDS), powerup: true }
  }
  return { text: pick(WORDS), powerup: false }
}
