# 🍉 Juicy Drop (Smashing Fruit)

[![Live Demo](https://img.shields.io/badge/Play%20Now-Live%20on%20Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://smashing-fruits.netlify.app)

**Juicy Drop** (*Smashing Fruit*) is a cozy, 2D physics-based **Suika / Fruit Merge** puzzle game built with **React**, **Matter.js**, **HTML5 Canvas**, and the **Web Audio API**. Drop adorable fruits into the glass jar, bounce and roll them together, unleash anti-gravity and magnetic power-ups, and merge matching pairs up the **13-tier evolution chain** all the way to the legendary **King Durian**!

👉 **Play Live**: [https://smashing-fruits.netlify.app](https://smashing-fruits.netlify.app)

---

## ✨ Features

- **Smart Swept-Circle Raycast Aiming**: Projects the exact landing ghost preview along the drop trajectory and glows emerald-gold with a `✨ MERGE!` badge when aimed directly onto a matching fruit.
- **Rapid-Merge Combo System**: Chain merges within a `2.2s` combo window to scale score multipliers up to `3.0x`, complete with musical ascending combo chimes, expanding shockwave rings, floating score popups, and screen shake.
- **Squash-and-Stretch & Tactile Physics**: Powered by **Matter.js** with custom bounciness, friction, density scaling, spring-damper impact deformation, and tier-pitched bounce thuds.
- **13 Fruit Evolution Tiers**: Merge matching fruits from a tiny **Cherry** (`2 pts`) past the slippery **Cucumber** (`48 pts`) and giant **Watermelon** (`2,048 pts`) all the way to the royal **King Durian** (`5,000 pts`).
- **Interactive Power-Up System**:
  - **🌀 Zero-G Anti-Gravity** (`Z` or `1` key / HUD button, `15s` cooldown, `5s` duration): Reverses gravity for `5 seconds` with a safety ceiling barrier—tap any floating fruit to impulse-launch it toward its matching twin!
  - **🧲 Magnet Beam** (`M` or `2` key / HUD button, `12s` cooldown, `2.2s` tractor pull): Locks onto the highest-tier matching fruit pair in the jar and pulls them together over `2.2 seconds` with an electric tractor beam.
- **Endless Mode & Session Stats**: Merge two Watermelons to evolve the **King Durian**, and merge two King Durians for `+10,000` bonus points and the `"👑 KING DURIAN CROWNED! 🎉"` victory—then choose **`Keep Playing (Endless)`** to keep chasing high scores, with a **Best Fruit / Max Combo / Total Merges** summary on Victory and Game Over screens.
- **Procedural Audio & Music**: Built-in **Web Audio API** synthesizer (ascending combo chimes, tier-pitched soft bounce thuds, and celebration fanfares) plus cozy background music with persistent Music and SFX mute controls.

---

## 🎮 How to Play & Controls

1. **Aim** the dropper horizontally across the top of the jar using the swept-circle ghost preview (`✨ MERGE!` highlights direct matching hits in emerald-gold).
2. **Drop** the current fruit into the jar (`450ms` drop cooldown). Only the first 5 tiers (**Cherry** through **Persimmon**) spawn in the dropper.
3. **Merge & Combo** identical fruits on contact within the `2.2s` combo chain window to evolve them into the next tier and scale multipliers up to `3.0x`!
4. **Activate Power-Ups** to unstick crowded piles in Zero-G or pull high-tier twins together across the jar with the Magnet Beam.
5. **Watch the Danger Line**: If settled fruits stay stacked above the red dashed danger line at the top of the jar for more than `2.5 seconds`, it's **Game Over**.

### Controls

| Input Method | Aim Left / Right | Drop Fruit | Zero-G Anti-Gravity | Magnet Beam | Pause / Modals |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mouse** | Move cursor inside the jar | Left Click / Release (or click floating fruit in Zero-G) | Click **Zero-G** HUD button | Click **Magnet** HUD button | Click **Menu** / `✕` button |
| **Touch** | Touch and drag inside the jar | Release finger (or tap floating fruit in Zero-G) | Tap **Zero-G** HUD button | Tap **Magnet** HUD button | Tap **Menu** / `✕` button |
| **Keyboard** | `←` / `→` Arrow Keys or `A` / `D` | `S` / `↓` / `Spacebar` / `Enter` | `Z` or `1` | `M` or `2` | `Escape` (closes modals / toggles pause menu) |

---

## ⚡ Power-Up System

| Power-Up | Shortcut | Cooldown | Duration | Effect |
| :--- | :---: | :---: | :---: | :--- |
| **🌀 Zero-G Anti-Gravity** | `Z` / `1` | `15s` | `5s` | Reverses gravity inside the jar with a protective ceiling barrier so fruits float upward without spilling over. Tap/click any floating fruit during Zero-G to impulse-launch it directly toward its matching twin! |
| **🧲 Magnet Beam** | `M` / `2` | `12s` | `2.2s` tractor pull | Scans the jar for the highest-tier matching pair of fruits, locks onto them with an electric tractor beam, and pulls them together over `2.2s` for an effortless merge. |

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
