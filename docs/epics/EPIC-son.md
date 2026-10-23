# EPIC — Son (sound and music)

| | |
| --- | --- |
| **Status** | Done |
| **Depends on** | Architecture milestones 5 (UI flow) and 6 (3D scene + `DayPlayer`) |
| **Related** | `ARCHITECTURE.md` §15 (event bus `app/events.ts`) |

## Decisions

- **Synthesized sounds.** Every sound is built in code from oscillators and filtered noise (`src/audio/synth.ts`, `src/audio/sounds.ts`). There are no audio files to download or license, and the total added size is a few kilobytes of code.
- **Defaults.** Sound effects are on and music is off. Both are remembered with the other preferences (`limonade.preferences.v1`), together with a volume from 1 to 5.
- **Controls.** A 🔊/🔇 button in the top bar mutes everything instantly. Accueil has a « ⚙️ Réglages » section with Son, Musique, Volume and Citronnelle's tips.
- **End of day.** The report's happy or sad jingle is the end-of-day sound, so a skipped day plays only that, never a burst of queued sounds.
- **Footsteps** were left out: with up to 60 visitors a day they made the stand noisy.

## Goal

Make the game feel alive and rewarding for a 10‑year‑old with sound. Short, clear sound effects confirm actions and make the selling day fun to watch. A light background music loop is optional. Sound must never be required to understand or play the game.

## Constraints

- **Static site only**: the game is hosted on GitHub Pages with no backend. Sound files ship in the build (`public/sons/`) and are never streamed from another site.
- **Licensing**: use only CC0 or properly credited, redistributable sounds, or sounds made for the project. Keep a `CREDITS.md` with each file's source and license.
- **Small download**: all sounds together should stay under about 1.5 MB. Use short `.ogg` files with `.mp3` fallbacks where Safari needs them.
- **Browser autoplay rules**: browsers block sound until the player interacts. The audio system must be unlocked on the first tap or click (« Nouvelle partie »).
- **Kid‑friendly**: soft, cheerful sounds with no harsh or scary ones. Volume should be moderate by default.
- **All labels in French** (« Son », « Musique », « Muet »).

## Technical approach

- A new `src/audio/` module uses the **Web Audio API**: one `AudioContext`, with separate gain nodes for sound effects and music.
- `AudioManager` subscribes to the existing typed event bus (`app/events.ts`). Game code, the core, and the scene do not change. Only the event → sound mapping is added.
- Sounds are loaded and decoded lazily after the first interaction, so they don't slow down the first page load.
- Rapid repeated events are limited (e.g. no more than one cash‑register sound every 120 ms), and pitch is varied slightly so repeated sounds don't get annoying.
- Settings (`limonade.audio.v1` in `localStorage`): sound effects on or off, music on or off, and volume.
- When the tab is hidden, the context is suspended so no audio plays in the background.

## Sound map (first proposal)

| Game event | Sound |
| --- | --- |
| `button_click` | soft "pop" |
| `stepper_plus` / `stepper_minus` | high / low "tick" |
| `purchase_confirmed` | bag rustle + coin |
| `action_refused` (not enough money…) | gentle "bonk" (never a harsh buzzer) |
| `stand_open` | small bell / fanfare |
| `customer_arrive` | footsteps (quiet) |
| `sale` | cash register "ding" + coins |
| `decline_too_expensive` | "hmm" murmur |
| `missed` (sold out) | disappointed "ohh" |
| `rain_start` / `rain_stop` | rain ambience fades in / out |
| `day_end` | evening jingle |
| `profit_positive` / `profit_negative` (Bilan) | happy jingle / soft "aww" |
| `game_end` | celebration fanfare |
| Background (optional) | light summer ukulele loop, quiet |

## User stories

1. **As a player**, I hear a satisfying "ding" every time I sell a cup, so I feel rewarded.
2. **As a player**, I hear rain when it starts raining during my day, so I understand why fewer customers come.
3. **As a player**, I hear a happy or sad jingle on the Bilan screen depending on my profit.
4. **As a player**, I can mute all sound or only the music with one big button in the top bar (🔊 / 🔇).
5. **As a parent**, the game stays muted if I muted it last time, even after reloading the page.
6. **As a player on a tablet**, the sound works after my first tap without any extra step.

## Stories / tasks breakdown

1. `AudioManager` skeleton: context, gain nodes, unlock on first interaction, suspend when hidden.
2. Settings: top‑bar mute toggle and a settings modal (Son / Musique / Volume), saved in `localStorage`.
3. Find, select, and compress the sound set, and write `CREDITS.md`.
4. Map events to sounds, with rate limiting and slight pitch variation.
5. Rain ambience loop synchronised with `DayPlayer` speed changes (×2) and the « Passer » skip.
6. Optional background music loop that ducks (gets quieter) during jingles.
7. Tests: unit tests for the mapping and rate limiting, using a mocked `AudioContext`, plus manual checks on Chrome, Firefox, Safari macOS, and Safari iPad.

## Acceptance criteria

- [x] No sound plays before the first user interaction, and there are no autoplay errors in the console.
- [x] Every event in the sound map plays its sound at the right moment during a normal day, at ×2 speed, and after « Passer » (skipping plays only the end‑of‑day jingle, never a burst of queued sounds).
- [x] The mute toggle works instantly and is remembered across reloads.
- [x] The game is fully playable and understandable with sound off.
- [x] The total size of the audio files is under about 1.5 MB, and sound loading doesn't delay the first screen (there are no audio files).
- [x] `CREDITS.md` lists every audio file with its license (it explains that all sounds are synthesized).
- [x] It works on the GitHub Pages build (no audio files, so no paths to get wrong).

## Out of scope

- Voice‑over or spoken French text.
- Sound in the 3D scene positioned by where the customer is (could come later).
- Music composition tools or dynamic music.

## Open questions

- Should sound be **on or off by default**? The proposal is on, with music off by default.
- Should there be background music at all, or only sound effects?
- Should we make custom sounds or use CC0 libraries (e.g. Kenney, freesound CC0)?
