# 🍉 Juicy Drop (Smashing Fruit)

[![Live Demo](https://img.shields.io/badge/Play%20Now-Live%20on%20Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://smashing-fruits.netlify.app)

**Juicy Drop** (*Smashing Fruit*) is a cozy, 2D physics-based **Suika / Fruit Merge** puzzle game built with **React**, **Matter.js**, **HTML5 Canvas**, and the **Web Audio API**. Drop adorable fruits into the glass jar, bounce and roll them together, unleash anti-gravity and magnetic power-ups, and merge matching pairs up the **13-tier evolution chain** all the way to the legendary **King Durian**!

👉 **Play Live**: [https://smashing-fruits.netlify.app](https://smashing-fruits.netlify.app)

---

## ✨ Features

- **🧸 Little Explorer Mode (Ages 3–5 Early Childhood Suite)**: A dedicated preschool sandbox on the Start Screen designed around early childhood pedagogy—while keeping **Classic** and **Daily Harvest** 100% untouched:
  - **🗣️ Friendly Spoken Fruit Vocabulary & `1–10` Counting**: Uses the Web Speech API (`KidVoice`, toggleable `Voice: On/Off`) + musical chimes to count merges aloud (`1–10`) and speak preschool-friendly color & size names (`"Red Cherry!"`, `"Juicy Tangerine!"`, `"Sunny Orange!"`, `"Big Yellow Pineapple!"`, `"Giant Green Watermelon!"`).
  - **🌈 No-Fail Bubble Pop Rescue & Gentle Motor Assist**: Removes scary red `DANGER!` alarms and Game Over screens—if fruits pile near the rim, up to `5` bottom berries cheerily pop into rainbow bubbles (`"Bubble pop! More room to play!"`). Includes larger touch-friendly Cherry (`26px`) & Strawberry (`34px`) colliders, `320ms` drop cadence, gentle `14px` twin-magnet roll assist, and `1–2` icon Smoothie Orders.
  - **🌙 Cozy `"Sleepy Fruits"` Parent Timer & `1.5s` Grown-Up Gate**: Configurable `Off / 5m / 10m / 15m` timer (`10m` default) that eases the final `30s` into a `0.88x` twilight lullaby before all fruits put on **starry blue-and-gold nightcaps** with floating `"zZz"` bubbles for a tear-free transition off the screen. Menu & `+5m` actions require a `1.5s` Grown-Up Hold (`🔒`).
- **Smoothie Orders & Juice Fever Mode**: Complete cozy, never-expiring visual fruit recipes (`2–3` fruit icons pinned on the café plaque above the dropper, `+150 pts` each) to fill the **3-step Smoothie Blender**. Filling `3/3` unleashes **12 seconds of Juice Fever**: `2.0x` points, `+1` tier upgraded drops (zero tiny Cherries!), faster `280ms` dropping, `+50%` power-up meter charge, rainbow jar lighting, and an upbeat `1.12x` music groove!
- **Smart Swept-Circle Raycast Aiming**: Projects the exact landing ghost preview along the drop trajectory and glows with contextual badges (`✨ MERGE!`, `🌈 WILDCARD!`, or `🫧 FIZZ BLAST!`) while lighting up target fruits with starry eyes in real time.
- **1-Slot Hold / Swap Basket**: Stash an awkward drop—or save a rare special drop for a clutch combo—using the HUD **HOLD** slot or `C` / `Shift` (`1` swap per drop, unlocked after each drop).
- **Earned & Paced Special Drops**: Trigger a `4x+` combo chain or hit every `20th` drop to earn a rare catalyst drop:
  - **🌈 Rainbow Dewdrop** (`r=28px`): Wildcard-merges with the first fruit it touches up to **Peach** (`Tier 9` -> **Pineapple**), grants a **`+250` Prismatic Bonus** on endgame fruits (**Pineapple** through **King Durian**) without consuming them, or merges with another Rainbow Dewdrop into a **Cucumber** (`Tier 6`).
  - **🫧 Fizz Berry** (`r=30px`): Settles into the pile and detonates when any adjacent merge happens nearby (or when two Fizz Berries collide), popping up to `3` nearby **Cherry** / **Strawberry** clutter berries for `2x` points and `+20%` power-up meter charge!
- **Rapid-Merge Combo System**: Chain merges within a `2.2s` combo window to scale score multipliers up to `3.0x`, complete with musical ascending combo chimes, expanding shockwave rings, floating score popups, and screen shake.
- **Reactive Fruit Expressions & Dynamic Audio Tension**: Fruits come alive with contextual procedural faces—starry-eyed merge anticipation, dizzy spirals after hard collisions, worried sweat drops near the danger line, shocked gasps during the overflow countdown, sleepy blinks at the bottom of the pile, and Zero-G joy—paired with smooth Web Audio background music tempo shifts (`0.94x` Zero-G float, `1.04x` simmer, `1.09x` danger rush) and a refreshing splash chime when danger clears.
- **Squash-and-Stretch & Tactile Physics**: Powered by **Matter.js** with custom bounciness, friction, density scaling, spring-damper impact deformation, and tier-pitched bounce thuds.
- **13 Fruit Evolution Tiers**: Merge matching fruits from a tiny **Cherry** (`2 pts`) past the slippery **Cucumber** (`48 pts`) and giant **Watermelon** (`2,048 pts`) all the way to the royal **King Durian** (`5,000 pts`).
- **Merge-Charged Power-Up System**: Zero passive waiting—both **Zero-G** and **Magnet** start at `100%` charge and refill strictly through merges (`1.75x` faster on `3x+` combos!):
  - **🌀 Zero-G Anti-Gravity** (`Z` or `1` key / HUD button, `100%` Juice Meter, `5s` duration): Reverses gravity for `5 seconds` with a safety ceiling barrier—tap any floating fruit to impulse-launch it toward its matching twin!
  - **🧲 Magnet Beam** (`M` or `2` key / HUD button, `100%` Juice Meter, `2.2s` tractor pull): Locks onto the highest-tier matching fruit pair in the jar and pulls them together over `2.2 seconds` with an electric tractor beam.
- **Daily Harvest Mode & Shareable Scorecards**: Compete on deterministic date-seeded daily drops (`DAILY HARVEST #<day>`) where every player worldwide gets the exact same drop sequence, track your daily personal best, and copy a Spoiler-Free emoji scorecard in one click on Victory or Game Over.
- **Endless Mode & Session Stats**: Merge two Watermelons to evolve the **King Durian**, and merge two King Durians for `+10,000` bonus points and the `"👑 KING DURIAN CROWNED! 🎉"` victory—then choose **`Keep Playing (Endless)`** to keep chasing high scores, with a **Best Fruit / Max Combo / Total Merges** summary on Victory and Game Over screens.
- **Procedural Audio & Music**: Built-in **Web Audio API** synthesizer (ascending combo chimes, basket swap swooshes, meter-ready arpeggios, prismatic shimmers, fizz pops, tier-pitched bounce thuds, and celebration fanfares) plus dynamic-tempo background music with persistent Music and SFX mute controls.

---

## 🎮 How to Play & Controls

1. **Choose Your Mode**: Play **Classic** for randomized arcade runs or **Daily Harvest** for today's deterministic global seed.
2. **Aim & Hold**: Aim horizontally with the swept-circle ghost preview (`✨ MERGE!`, `🌈 WILDCARD!`, `🫧 FIZZ BLAST!`), or press **HOLD** (`C` / `Shift`) once per turn to stash/swap with your basket.
3. **Drop & Evolve**: Drop fruits (`450ms` cooldown) to merge identical pairs within the `2.2s` combo window—scaling score multipliers up to `3.0x`, charging your **Zero-G** & **Magnet** meters, and earning **Rainbow Dewdrop** or **Fizz Berry** catalysts on `4x+` combos (or every `20` drops)!
4. **Unleash Merge-Charged Power-Ups**: Spend full `100%` Juice Meters to float and tap-launch fruits in **Zero-G** or tractor-pull high-tier twins with **Magnet**.
5. **Watch the Danger Line**: Fruits near the red dashed danger line start sweating as the music speeds up—if settled fruits stay above the line for more than `2.5 seconds`, it's **Game Over**.

### Controls

| Input Method | Aim Left / Right | Drop Fruit | Hold / Swap Basket | Zero-G Anti-Gravity | Magnet Beam | Pause / Modals |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Mouse** | Move cursor inside the jar | Left Click / Release (or click floating fruit in Zero-G) | Click **HOLD** HUD slot | Click **Zero-G** HUD button | Click **Magnet** HUD button | Click **Menu** / `✕` button |
| **Touch** | Touch and drag inside the jar | Release finger (or tap floating fruit in Zero-G) | Tap **HOLD** HUD slot | Tap **Zero-G** HUD button | Tap **Magnet** HUD button | Tap **Menu** / `✕` button |
| **Keyboard** | `←` / `→` Arrow Keys or `A` / `D` | `S` / `↓` / `Spacebar` / `Enter` | `C` or `Shift` | `Z` or `1` | `M` or `2` | `Escape` (closes modals / toggles pause menu) |

---

## ⚡ Power-Up System (Merge-Charged)

| Power-Up | Shortcut | Charge Economy | Duration | Effect |
| :--- | :---: | :---: | :---: | :--- |
| **🌀 Zero-G Anti-Gravity** | `Z` / `1` | Starts at `100%`; refills via merges (`+10%` + tier bonus, `1.75x` on `3x+` combos) | `5s` | Reverses gravity inside the jar with a protective ceiling barrier so fruits float upward without spilling over. Tap/click any floating fruit during Zero-G to impulse-launch it directly toward its matching twin! |
| **🧲 Magnet Beam** | `M` / `2` | Starts at `100%`; refills via merges (`+14%` + tier bonus, `1.75x` on `3x+` combos) | `2.2s` tractor pull | Scans the jar for the highest-tier matching pair of fruits, locks onto them with an electric tractor beam, and pulls them together over `2.2s` for an effortless merge. |

---

## 🍒 The 13 Fruit Evolution Tiers

When two identical fruits touch, they merge into the next fruit tier and award points (multiplied up to `3.0x` during rapid-merge combos):

| Tier | Fruit | Radius (px) | Base Points | Spawnable in Dropper? | Special Properties |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | 🍒 **Cherry** | `22` | `2` | Yes | Standard physics |
| **2** | 🍓 **Strawberry** | `30` | `4` | Yes | Standard physics |
| **3** | 🍇 **Grape** | `40` | `8` | Yes | Standard physics |
| **4** | 🍊 **Dekopon** | `50` | `16` | Yes | Standard physics |
| **5** | 🟠 **Persimmon** | `60` | `32` | Yes | Highest dropper spawn tier |
| **6** | 🥒 **Cucumber** | `52` | `48` | Merge Only | **Slippery low-friction skin** (`0.005` friction) — slides into tight gaps |
| **7** | 🍎 **Apple** | `72` | `64` | Merge Only | Standard physics |
| **8** | 🍐 **Pear** | `86` | `128` | Merge Only | Standard physics |
| **9** | 🍑 **Peach** | `100` | `256` | Merge Only | Standard physics |
| **10** | 🍍 **Pineapple** | `116` | `512` | Merge Only | Standard physics |
| **11** | 🍈 **Melon** | `134` | `1,024` | Merge Only | Standard physics |
| **12** | 🍉 **Watermelon** | `154` | `2,048` | Merge Only | Merges into the royal **King Durian** |
| **13** | 👑 **King Durian** | `130` | `5,000` | Merge Only | **Heavy royal fruit** (`0.005` density) with spiky golden crown aura; merging two awards **`+10,000` bonus pts**, triggers `"👑 KING DURIAN CROWNED! 🎉"`, and unlocks **`Keep Playing (Endless)`**! |

---

## 🛠️ Tech Stack

- **UI Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Tailwind CSS v4](https://tailwindcss.com/)
- **Physics Engine**: [Matter.js](https://brm.io/matter-js/)
- **Rendering**: HTML5 2D Canvas (`720x1200` logical resolution with responsive DPI scaling, swept-circle raycast preview, squash-and-stretch deformation, & procedural vector sprites)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Audio**: Web Audio API procedural sound effects & background music
- **Bundler**: [Vite](https://vite.dev/)

---

## 🚀 Local Development & Build

### Prerequisites

- **Node.js** `>= 18.x`
- **npm** `>= 9.x`

### Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open the local URL shown in your terminal (typically `http://localhost:5173`) in your browser.

3. **Build for production**:
   ```bash
   npm run build
   ```
   This bundles the production-ready static assets into the `dist/` directory.

4. **Preview the production build locally**:
   ```bash
   npm run preview
   ```

---

## 📄 License & Notices

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for third-party library licenses and asset attributions.
