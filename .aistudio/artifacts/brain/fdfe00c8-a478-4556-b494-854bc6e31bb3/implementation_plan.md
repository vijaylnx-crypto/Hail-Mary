# Dedicated Account Tab & Profile Screen

Add a dedicated "Account" tab directly to the bottom navigation bar alongside a dedicated full-screen Account management view with Google Authentication, real-time cloud synchronization, and backup statistics.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Placement**: In Phase 1, you confirmed placing the Account button as a **dedicated tab in the bottom navigation bar**. This ensures immediate thumb reach, persistent status indicators, and clear discoverability across mobile and desktop devices.

- **Confirmed Placement**: Dedicated 5th tab (`👤 Account`) in the fixed bottom navigation bar (`Today`, `Log`, `Sleep`, `Reports`, `Account`).
- **Screen Architecture**: Dedicated screen view (`#scr-account`) seamlessly integrated into the navigation system, replacing the modal-only constraint while maintaining instant back-and-forth transitions.
- **Sync & Authentication Backend**: Firebase Authentication with Google Sign-In and Cloud Firestore (`users/{userId}/data/records`) for cross-device persistence.

---

### 1. Overview & Core Concept

- **What It Does**: Integrates an "Account" tab into the primary bottom navigation bar. Tapping the tab opens a dedicated, responsive account management view showing authentication status, user profile details (Google avatar, display name, email), cloud sync telemetry, manual backup triggers, and lifetime aggregate metrics (total meals, logged activities, tracked days).
- **Target Audience / Persona**: ORBIT Health Tracker users who want to safely safeguard their health history, sync entries across phone and desktop, and inspect their account status without hunting inside nested settings menus.
- **Key Value**: Guarantees zero friction for authentication and cloud backup; transforms cloud sync from a hidden modal into a first-class citizen of the app navigation.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Discovery & Navigation*: User looks at the bottom navigation bar and immediately sees `[🪐 Today]`, `[🛰️ Log]`, `[🌙 Sleep]`, `[✨ Reports]`, and `[👤 Account]`. Tapping `Account` highlights the tab and switches to the Account screen.
  2. *Guest / Signed-Out State*: Clean card view indicating "Local Guest Mode Active", showing that logs are currently cached safely in the browser, with a prominent Google Sign-In button.
  3. *Authentication Flow*: User taps "Sign in with Google" -> interactive Google Auth popup -> successful sign-in transitions the view to "Cloud Sync Active" with verified profile avatar, email, and live sync timestamp.
  4. *Active Cloud Management*: Signed-in users can trigger on-demand sync ("☁️ Sync Now"), inspect stored cloud records (meals, activities, days), or safely sign out.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Deep-space cosmic theme with dark slate navy surfaces (`#060814`, `#0D1226`, `#131B38`), violet star highlights (`#A78BFA`), and aurora green sync signals (`#34D399`).
  - *Bottom Bar Rhythm*: 5-column balanced flex distribution, $44\text{px}+$ touch targets, subtle glowing icons when active, and responsive outdoor high-contrast mode compatibility.
  - *Typography & Hierarchy*: Display headings in clean semibold sans-serif with unboxed, natural metadata (no static pill clutter).
- **Interactive Feedback & Motion**:
  - Tactile active tab state with subtle glow drop-shadow.
  - Real-time pulsating status dot (`#34D399`) indicating cloud backup health.
  - Toast confirmation notifications for sign-in, cloud upload, and sign-out actions.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full Navigation Screen vs. Modal Overlay**
  - *Chosen Approach*: Implement Account as a first-class screen (`#scr-account`) in the tab router, while preserving the existing modal trigger as a secondary path or aliasing it.
  - *Why*: Bottom navigation tabs that trigger modal popups feel disjointed on mobile devices; standard mobile UX conventions expect bottom tabs to navigate to full screens.
  - *Alternatives Considered*: Floating modal triggered from nav tab (feels clunky on mobile viewports).
- **Decision 2: 5-Tab Bar Layout vs. Overflow Menu**
  - *Chosen Approach*: 5 evenly distributed tabs (`Today`, `Log`, `Sleep`, `Reports`, `Account`).
  - *Why*: 5 tabs is the standard ergonomic sweet spot for mobile tab bars (iOS HIG and Material Design recommend 3–5 items), maintaining clear 44px+ hit targets across smartphone screens.
  - *Alternatives Considered*: Moving Reports into Account (hides key health visualizations).
- **Decision 3: Offline-First Hybrid Cloud Sync**
  - *Chosen Approach*: Keep IndexedDB/localStorage as the immediate write cache, syncing upstream to Firestore upon network availability and authentication.
  - *Why*: Instant UI response with zero loading lag, offline reliability, and resilient cloud backup.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│               ORBIT Bottom Navigation                  │
│  [Today]   [Log]   [Sleep]   [Reports]   [👤 Account]  │
└──────────────────────────┬─────────────────────────────┘
                           │ switches view
                           ▼
┌────────────────────────────────────────────────────────┐
│                 #scr-account Screen                     │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Profile Banner: Avatar, Name, Email, Sync Status   │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ Auth Actions: [Google Sign In] / [Sign Out]        │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ Cloud Stats: Meals Logged, Workouts, Total Days    │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ Data Controls: [☁️ Sync Now] [📥 Export Local JSON]│ │
│ └────────────────────────────────────────────────────┘ │
└──────────────────────────┬─────────────────────────────┘
                           │
                 Firebase Auth & Firestore
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│  Firestore: /users/{userId}/data/records               │
│  - foods, acts, weights, sleeps, water, profile        │
└────────────────────────────────────────────────────────┘
```

- **State & Router Integration**:
  - Update `const screens = ["today", "log", "sleep", "reports", "account"];` in `index.html`.
  - Add `<button data-scr="account"><span class="ic">👤</span>Account</button>` to the `<nav>` container.
  - Build `<section class="screen" id="scr-account">` containing the dedicated account card, Google login controls, sync status badge, and lifetime stats.
  - Bind Firebase `onAuthStateChanged` to automatically render the user profile avatar, name, email, and live cloud stats in both the screen and the top header.
- **Verification Plan**:
  - Validate bottom nav rendering across mobile (375px) and desktop viewports.
  - Test screen switching between Today, Log, Sleep, Reports, and Account.
  - Test Google Sign-in flow, user profile presentation, and cloud sync trigger.
