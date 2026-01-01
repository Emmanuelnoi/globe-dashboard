# 🌍 3D Global Dashboard

<div align="center">

**Production-grade interactive 3D globe built with Angular 20 (Zoneless)**
Real scientific data • 60fps WebGL performance • Enterprise-quality architecture

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Angular](<https://img.shields.io/badge/Angular-20_(Zoneless)-red?logo=angular>)](https://angular.io)
[![Tests](https://img.shields.io/badge/tests-604_total-brightgreen)](https://github.com/Emmanuelnoi/3d-global-dashboard)
[![Coverage](https://img.shields.io/badge/coverage-86.4%25-brightgreen)](https://github.com/Emmanuelnoi/3d-global-dashboard)
[![CI](https://img.shields.io/badge/CI-⭐⭐⭐⭐⭐_Enterprise-success)](https://github.com/Emmanuelnoi/3d-global-dashboard/actions)

[**🎯 Live Demo**](https://globe-dashboard-zeta.vercel.app/) • [**📖 Docs**](docs/README.md) • [**🏗️ Architecture**](docs/ARCHITECTURE.md) • [**🤝 Contributing**](docs/community/CONTRIBUTING.md)

</div>

---

## 📸 Preview

![3D Global Dashboard](public/Globe-dashboard.gif)

_Interactive WebGL globe with smooth 60fps rotation, country selection, 241+ bird species migration paths, real-time quizzes, and cloud-synced progress._

---

## 🎯 Executive Summary

Most geographic tools are either **too simple** (static maps) or **too complex** (GIS software). This project bridges that gap by combining interactive education with production-grade engineering.

**What It Does:**

- 🌍 **Interactive Geography** – GPU-optimized raycasting for 241 countries
- 🐦 **Scientific Visualization** – Real-time migration paths (subset of 2.5B GBIF observations)
- 🎮 **Gamified Learning** – Quizzes, achievements, global leaderboards
- ⚡ **Production Quality** – 86.4% test coverage, enterprise CI/CD, WCAG AA accessibility

**Built to Showcase:** Angular 20 Zoneless, advanced 3D rendering, big data orchestration, memory profiling, and enterprise CI/CD.

---

## 📊 Project Stats (At-a-Glance)

| Metric            | Value           | Metric             | Value             |
| ----------------- | --------------- | ------------------ | ----------------- |
| **Lines of Code** | 42,234 TS       | **CI/CD Maturity** | ⭐⭐⭐⭐⭐ (5/5)  |
| **Components**    | 47 standalone   | **Bundle Size**    | 407kB gzipped     |
| **Services**      | 37 signal-based | **Performance**    | 60fps / 0fps idle |
| **Databases**     | 6 IndexedDB     | **Load Time**      | <2s on 3G         |
| **Tests**         | 604 total       | **Blocking Tests** | 487 (100% pass)   |

---

## ✨ Engineering Excellence

| Pillar            | Implementation                       | Measurable Impact                               |
| ----------------- | ------------------------------------ | ----------------------------------------------- |
| **Performance**   | Render-on-demand + Zoneless Signals  | 0fps idle, 60fps interaction, 90% GPU reduction |
| **Big Data**      | Local-First IndexedDB Cache (6 DBs)  | 89% network reduction, <400ms loads             |
| **Quality**       | 487 blocking tests + 26 E2E tests    | 100% CI pass rate, 86.4% coverage               |
| **Security**      | 3-Tier pnpm auditing + RLS Policies  | Zero critical CVEs in production                |
| **Accessibility** | 13 axe-core audits + SR-only regions | WCAG 2.1 AA (rare for 3D/WebGL)                 |

---

## 🏗️ Architecture (Overview)

```
┌─────────────────────────────────────┐
│  UI (Globe, Quiz, Migration, Leaderboards)
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  Signal-Based Service Layer (37 services)
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  Local-First Data Layer             │
│  IndexedDB (primary) ↔ Supabase (sync)
└─────────────────────────────────────┘
```

**Key Patterns:** Local-First • Zoneless Signals • Render-on-Demand • Strict TypeScript (zero `any`)

→ **Deep dives:** [Architecture](docs/ARCHITECTURE.md) • [Performance](docs/PERFORMANCE.md) • [Data Flow](docs/DATA_FLOW.md)

---

## 🧠 Technical Deep Dives (Case Studies)

<details>
<summary><b>1. The Angular-Three.js Bridge (Advanced Pattern)</b></summary>

**Challenge:** Integrating 60fps Three.js render loop into Angular without "Zone pollution" triggering thousands of unnecessary change detection cycles.

**Solution:**

- Decoupled loop using `ngZone.runOutsideAngular()`
- Leveraged Angular 20 Signals for state synchronization
- Implemented Render-on-Demand: Loop executes only when Signal notifies state change (hover/drag), otherwise 0fps

```typescript
this.ngZone.runOutsideAngular(() => {
  this.startRenderLoop(); // Outside Zone.js
});

private startRenderLoop() {
  if (!this.needsRender) return; // 0fps idle
  requestAnimationFrame(() => this.startRenderLoop());
  this.renderer.render(this.scene, this.camera);
}
```

**Win:** 60fps constant, 0fps idle (90% GPU reduction), zero zone pollution

</details>

<details>
<summary><b>2. Orchestrating 2.5B Data Points (Local-First)</b></summary>

**Challenge:** Visualizing scientific GBIF data without hitting rate limits or crashing browser heap.

**Solution:**

- **Validation Layer:** Rejects ~15% of records lacking coordinates/timestamps
- **IndexedDB Sync:** 6-database system as write-through cache for GBIF API
- **Spatial Indexing:** PostgreSQL PostGIS extensions for coordinate-based clustering (species within 50km radius)
- **Data Aggregation:** Users search specific species, not all 2.5B records; Supabase query optimizer handles geospatial filters

**Data Flow:**

```
API Request → Validation (15% rejection) → IndexedDB Cache (7-day TTL) → 89% hit rate
```

**Key Trade-off:** Chose IndexedDB over LocalStorage to handle unlimited scientific datasets and spatial queries, despite increased complexity of asynchronous API handling.

**Win:** 89% cache hit rate, <400ms loads, 5s-debounced background sync

</details>

<details>
<summary><b>3. Memory Optimization & Timer Leak Fix</b></summary>

**Challenge:** 7,200+ timer leak via Chrome DevTools caused browser crashes after 1 hour (2GB+ RAM).

**Solution:** Replaced legacy `setInterval` with managed RxJS stream.

```typescript
// BEFORE (Memory Leak)
setInterval(() => this.processQueue(), 100);

// AFTER (Memory Safe)
this.achievementQueue$
  .pipe(
    switchMap(() => timer(0, 100)),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe(() => this.processQueue());
```

**Win:** Memory reduced from 2GB+ to <200MB after 1 hour

</details>

<details>
<summary><b>4. WCAG AA Accessibility in 3D Context</b></summary>

Most 3D/WebGL apps are completely inaccessible. This project proves visual richness and accessibility are compatible.

**How We Made WebGL Accessible:**

- **Screen Readers:** SR-only live regions (`aria-live="polite"`) announce country data during 3D hover
- **Keyboard Nav:** Tab/Arrow key support for globe rotation and selection
- **Focus Management:** Visible 2px blue outline for all interactive elements
- **Motion Sensitivity:** Respects `prefers-reduced-motion` by disabling auto-rotation
- **Color Contrast:** Glass morphism UI maintains 4.5:1 ratio

**Win:** WCAG 2.1 AA compliant with 13 automated axe-core audits passing

</details>

<details>
<summary><b>5. Enterprise CI/CD Pipeline (⭐⭐⭐⭐⭐ 5/5 Maturity)</b></summary>

**Gradual Enforcement Strategy:**

```
┌────────────────────────────────────────┐
│ 6-Job GitHub Actions Pipeline          │
├────────────────────────────────────────┤
│ 1. Code Quality     → BLOCKING         │
│    ├─ ESLint        → 0 errors         │
│    └─ TypeScript    → 0 errors         │
├────────────────────────────────────────┤
│ 2. Unit Tests       → GRADUAL          │
│    ├─ Blocking      → 487 tests (100%) │
│    └─ All + Coverage→ 604 tests (86%)  │
├────────────────────────────────────────┤
│ 3. Security Audit   → 3-TIER           │
│    ├─ Critical CVEs → BLOCKING         │
│    ├─ High CVEs     → WARNING          │
│    └─ Moderate CVEs → MONITORING       │
├────────────────────────────────────────┤
│ 4. E2E/Build/Deploy → BLOCKING         │
└────────────────────────────────────────┘
```

**Win:** Enterprise-grade quality gates without blocking deployment velocity

</details>

---

## 🛠️ Tech Stack

**Frontend:** Angular 20 (Zoneless, Signals) • Three.js (WebGL, GLSL) • TypeScript 5.8 (Strict)
**Data Layer:** Supabase (PostgreSQL + PostGIS) • IndexedDB (6-DB Local-First) • GBIF API
**DevOps:** Vitest (604 tests) • Playwright (26 E2E) • GitHub Actions • Vercel

→ **Full stack:** [Tech Details](docs/ARCHITECTURE.md#tech-stack)

---

## 🚀 Quick Start

```bash
git clone https://github.com/Emmanuelnoi/3d-global-dashboard.git
cd 3d-global-dashboard
pnpm install              # Requires pnpm >= 8.0.0
pnpm start                # → http://localhost:4200

# Testing
pnpm test                 # All 604 tests
pnpm run test:blocking    # 487 blocking tests (CI)
pnpm run e2e              # 26 Playwright E2E tests
```

→ **Full setup:** [Dev Guide](docs/DEVELOPMENT_GUIDE.md) • [Deployment](docs/DEPLOYMENT.md)

---

## 💼 For Hiring Managers

This project demonstrates **senior-level full-stack engineering**:

**What You Learn About Me:**

1. ⚡ **Advanced 3D Graphics** – Solved Angular-Three.js zone pollution (30fps → 60fps)
2. 🧠 **Memory Profiling** – Found/fixed 7,200+ timer leak using Chrome DevTools
3. 📊 **Big Data** – Architected Local-First pipeline for 2.5B+ GBIF observations with PostGIS spatial indexing
4. 🔒 **Enterprise CI/CD** – Built ⭐⭐⭐⭐⭐ pipeline with gradual enforcement
5. ♿ **Accessibility** – Achieved WCAG 2.1 AA in complex 3D WebGL app

**Engineering Philosophy:** "Pick the right tech, not the best tech" – Acknowledges trade-offs (IndexedDB complexity vs unlimited storage), plans mitigation (see [Trade-offs](docs/TRADE_OFFS.md)).

→ **Deep dives:** [Architecture](docs/ARCHITECTURE.md) • [Performance](docs/PERFORMANCE.md) • [Testing](docs/TESTING.md)

---

## 🤝 Contributing

- 🐛 **Bug Reports** – [Open an issue](https://github.com/Emmanuelnoi/3d-global-dashboard/issues)
- 💡 **Feature Ideas** – Share suggestions
- 📝 **Documentation** – Improve guides
- 🔧 **Code** – Submit pull requests

→ **Guidelines:** [Contributing](docs/community/CONTRIBUTING.md) • [Commit Guide](docs/community/COMMIT_GUIDE.md)

---

## 📄 License

MIT License – see [LICENSE](LICENSE)

---

## 📧 Contact

**Emmanuel Noi** ([@Emmanuelnoi](https://github.com/Emmanuelnoi))
📧 [emttechh@gmail.com](mailto:emttechh@gmail.com) • 🐛 [Issues](https://github.com/Emmanuelnoi/3d-global-dashboard/issues)

---

<div align="center">

**🌍 Explore 241 countries • Track 241+ bird species • Unlock 14 achievements 🐦**

**Made with TypeScript by [Emmanuel Noi](https://github.com/Emmanuelnoi)**

</div>
