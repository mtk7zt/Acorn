# Acorn Mobile Product Specification (iOS, Android & Responsive PWA)

### 1. Navigation Architecture
The mobile product experience (`ProductPrototypeShell.tsx`) uses a thumb-friendly 5-destination bottom navigation bar:
1. **Briefing:** Calm morning summary (“Good morning, Sosa. I kept watch.”) and top high-signal roles.
2. **Signals:** Filterable stream of recent and saved Signals (`All`, `Early signals`, `Saved`) with tap actions (`View role`, `Check my fit`, `Not for me`).
3. **Acorn (Center Core Tab):** Direct natural-language conversation with the living `<AcornMascot />` and one-tap prompt chips.
4. **Activity:** Transparent chronological log of Acorn's background work (“7:42 AM — Looked across your tracked roles”).
5. **You:** Career watch preferences (roles, locations, remote preference, seniority) and one-tap privacy/memory controls.

### 2. iOS & Android Native Behaviour Specification
- **Push Notifications:** Rich notification payloads displaying Acorn in `found` state with two quick actions: `Check Fit` and `Save Signal`.
- **iOS Messages Extension:** Allows sharing a clean Signal card in iMessage threads and inspecting morning signals via an interactive drawer anchored to the main iOS app.
- **Haptics & Motion:** Subtle selection haptics on Signal save and Fit Check completion; respects system `UIAccessibility.isReduceMotionEnabled` / Android Animator duration scale.
