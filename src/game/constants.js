// Gameplay tunables — adjust these to change game feel.

export const BUCKET_CAPACITY = 30    // marbles needed to fill your bucket = you WIN
export const MARBLES_PER_WORD = 1    // marbles added to YOUR bucket per normal word
export const ROW_SIZE = 6            // marbles per visual row; a power-up clears the opponent's top row
export const POWERUP_CHANCE = 0.15   // probability a given word is a power-up word
export const COUNTDOWN_SECONDS = 3   // 3-2-1 countdown before play begins

// How many marbles sit in the top (highest) visible row for a bucket of `n`
// marbles, given ROW_SIZE-per-row wrapping. This is what an opponent's
// power-up knocks out. 0 for an empty bucket; a full row otherwise.
export function topRowCount(n) {
  if (n <= 0) return 0
  return n % ROW_SIZE || ROW_SIZE
}

// Single-player bot presets. `wordMs` is a [min, max] range: before EACH word
// the bot re-rolls a fresh delay from this band, so its typing speed varies
// word-to-word rather than being a fixed metronome. Lower range = faster typing.
// `powerupChance` is the odds a given bot word is an offensive power-up that
// knocks a row out of the player's bucket. Ranges don't overlap between levels.
export const BOT_DIFFICULTY = {
  easy:   { label: 'Easy',   wordMs: [2100, 3200], powerupChance: 0.05 },
  medium: { label: 'Medium', wordMs: [1300, 2100], powerupChance: 0.12 },
  hard:   { label: 'Hard',   wordMs: [ 800, 1300], powerupChance: 0.20 },
}
