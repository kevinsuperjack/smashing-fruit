# 🍉 Juicy Drop (Smashing Fruit)

[![Live Demo](https://img.shields.io/badge/Play%20Now-Live%20on%20Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://juicy-drop-fruit-game.netlify.app)

**Juicy Drop** (*Smashing Fruit*) is a cozy, 2D physics-based **Suika / Fruit Merge** puzzle game built with **React**, **Matter.js**, **HTML5 Canvas**, and the **Web Audio API**. Drop adorable fruits into the glass jar, bounce and roll them together, and merge matching pairs up the evolution chain all the way to the giant **Watermelon**!

👉 **Play Live**: [https://juicy-drop-fruit-game.netlify.app](https://juicy-drop-fruit-game.netlify.app)

---

## ✨ Features

- **2D Rigid-Body Physics**: Powered by **Matter.js** with custom bounciness, friction, density scaling, and squash-and-stretch animations.
- **11 Fruit Evolution Tiers**: Merge matching fruits from a tiny **Cherry** (`2 pts`) up to a massive **Watermelon** (`2,048 pts`).
- **Combo & Particle Effects**: Chain rapid merges together to trigger combo multipliers, floating score popups, and juicy splash particles.
- **Procedural Audio & Music**: Built-in **Web Audio API** synthesizer and background music engine with independent Music and SFX volume controls.
- **Two Watermelons Victory & Endless Mode**: Merge two Watermelons for an explosive grand finale, or continue playing in Endless Mode to chase a new high score.

---

## 🎮 How to Play & Controls

1. **Aim** the dropper cloud horizontally across the top of the jar using the laser guide line.
2. **Drop** the current fruit into the jar. Only the first 5 tiers (**Cherry** through **Persimmon**) spawn in the dropper.
3. **Merge** two identical fruits on contact to evolve them into the next tier and earn points!
4. **Watch the Danger Line**: If stacked fruits stay above the red dashed danger line at the top of the jar for more than `2.5 seconds`, it's **Game Over**.

### Controls

| Input Method | Aim Left / Right | Drop Fruit |
| :--- | :--- | :--- |
| **Mouse** | Move cursor inside the jar | Left Click / Release |
| **Touch** | Touch and drag inside the jar | Release finger |
| **Keyboard** | `←` / `→` Arrow Keys or `A` / `D` | `Spacebar` or `Enter` |

---

## 🍒 The 11 Fruit Evolution Tiers

When two identical fruits touch, they merge into the next fruit tier and award points:

| Tier | Fruit | Radius (px) | Points Awarded | Spawnable in Dropper? |
| :---: | :--- | :---: | :---: | :---: |
| **1** | 🍒 **Cherry** | `22` | `2` | Yes |
| **2** | 🍓 **Strawberry** | `30` | `4` | Yes |
| **3** | 🍇 **Grape** | `40` | `8` | Yes |
| **4** | 🍊 **Dekopon** | `50` | `16` | Yes |
| **5** | 🟠 **Persimmon** | `60` | `32` | Yes |
| **6** | 🍎 **Apple** | `72` | `64` | Merge Only |
| **7** | 🍐 **Pear** | `86` | `128` | Merge Only |
| **8** | 🍑 **Peach** | `100` | `256` | Merge Only |
| **9** | 🍍 **Pineapple** | `116` | `512` | Merge Only |
| **10** | 🍈 **Melon** | `134` | `1,024` | Merge Only |
| **11** | 🍉 **Watermelon** | `154` | `2,048` | Merge Only |

---

## 🛠️ Tech Stack

- **UI Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Physics Engine**: [Matter.js](https://brm.io/matter-js/)
- **Rendering**: HTML5 2D Canvas (`720x1200` logical resolution with responsive scaling)
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
