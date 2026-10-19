# 🍉 Juicy Drop (Smashing Fruit)

[![Live Demo](https://img.shields.io/badge/Play%20Now-Live%20on%20Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://smashing-fruits.netlify.app)

**Juicy Drop** (*Smashing Fruit*) is a cozy, 2D physics-based **Suika / Fruit Merge** puzzle game built with **React**, **Matter.js**, **HTML5 Canvas**, and the **Web Audio API**. Drop adorable fruits into the glass jar, bounce and roll them together, unleash anti-gravity and magnetic power-ups, and merge matching pairs up the **13-tier evolution chain** all the way to the legendary **King Durian**!

👉 **Play Live**: [https://smashing-fruits.netlify.app](https://smashing-fruits.netlify.app)

---

## ✨ Features

- **2D Rigid-Body Physics**: Powered by **Matter.js** with custom bounciness, friction, density scaling, and squash-and-stretch animations.
- **13 Fruit Evolution Tiers**: Merge matching fruits from a tiny **Cherry** (`2 pts`) past the slippery **Cucumber** (`48 pts`) and giant **Watermelon** (`2,048 pts`) all the way to the royal **King Durian** (`5,000 pts`).
- **Interactive Power-Up System**:
  - **🌀 Zero-G Anti-Gravity** (`Z` or `1` key / HUD button, `25s` cooldown): Reverses gravity for `5 seconds` with a safety ceiling barrier—tap any floating fruit to launch it toward its matching twin!
  - **🧲 Magnet Beam** (`M` or `2` key / HUD button, `20s` cooldown): Locks onto the highest-tier matching fruit pair in the jar and pulls them together with an electric tractor beam.
- **Snappy Dropper & Combo Effects**: Fast `450ms` drop cooldown, rapid-merge combo multipliers, floating score popups, and juicy splash particles.
- **Procedural Audio & Music**: Built-in **Web Audio API** synthesizer and background music engine with independent Music and SFX volume controls.
- **King Durian Crowned Victory & Endless Mode**: Merge two Watermelons to evolve the **King Durian**, and merge two King Durians for `+10,000` bonus points and the `"👑 KING DURIAN CROWNED! 🎉"` grand finale—or keep playing in Endless Mode!

---

## 🎮 How to Play & Controls

1. **Aim** the dropper cloud horizontally across the top of the jar using the laser guide line.
2. **Drop** the current fruit into the jar (`450ms` drop cooldown). Only the first 5 tiers (**Cherry** through **Persimmon**) spawn in the dropper.
3. **Merge** two identical fruits on contact to evolve them into the next tier and earn points!
4. **Activate Power-Ups** to unstick crowded piles or pull high-tier twins together across the jar.
5. **Watch the Danger Line**: If stacked fruits stay above the red dashed danger line at the top of the jar for more than `2.5 seconds`, it's **Game Over**.

### Controls

| Input Method | Aim Left / Right | Drop Fruit | Zero-G Anti-Gravity | Magnet Beam |
| :--- | :--- | :--- | :--- | :--- |
| **Mouse** | Move cursor inside the jar | Left Click / Release (or click floating fruit in Zero-G) | Click **Zero-G** HUD button | Click **Magnet** HUD button |
| **Touch** | Touch and drag inside the jar | Release finger (or tap floating fruit in Zero-G) | Tap **Zero-G** HUD button | Tap **Magnet** HUD button |
| **Keyboard** | `←` / `→` Arrow Keys or `A` / `D` | `Spacebar` or `Enter` | `Z` or `1` | `M` or `2` |

---

## ⚡ Power-Up System

| Power-Up | Shortcut | Cooldown | Duration | Effect |
| :--- | :---: | :---: | :---: | :--- |
| **🌀 Zero-G Anti-Gravity** | `Z` / `1` | `25s` | `5s` | Reverses gravity inside the jar with a protective ceiling barrier so fruits float upward without spilling over. Tap/click any floating fruit during Zero-G to impulse-launch it directly toward its matching twin! |
| **🧲 Magnet Beam** | `M` / `2` | `20s` | Instant / Pull | Scans the jar for the highest-tier matching pair of fruits, locks onto them with an electric tractor beam, and pulls them together for an effortless merge. |

---

## 🍒 The 13 Fruit Evolution Tiers

When two identical fruits touch, they merge into the next fruit tier and award points:

| Tier | Fruit | Radius (px) | Points Awarded | Spawnable in Dropper? | Special Properties |
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
| **13** | 👑 **King Durian** | `130` | `5,000` | Merge Only | **Heavy royal fruit** (`0.005` density) with spiky golden crown aura; merging two awards **`+10,000` bonus pts** & triggers `"👑 KING DURIAN CROWNED! 🎉"` victory! |

---

## 🛠️ Tech Stack

- **UI Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Physics Engine**: [Matter.js](https://brm.io/matter-js/)
- **Rendering**: HTML5 2D Canvas (`720x1200` logical resolution with responsive scaling & procedural vector sprites)
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
   This compiles TypeScript and bundles the production-ready static assets into the `dist/` directory.

4. **Preview the production build locally**:
   ```bash
   npm run preview
   ```

---

## 📄 License & Notices

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for third-party library licenses and asset attributions.
