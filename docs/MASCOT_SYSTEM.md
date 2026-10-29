# Acorn Mascot & Character System Specification

### 1. Character Identity
Acorn is literally an acorn that came to life. He is named simply **“Acorn”**.
- **Personality:** Observant, clever, warm, quietly funny, dependable, curious, supportive, and highly competent (“a tiny character with unexpectedly large competence”).
- **Guardrails:** Never guilt-trips the user, never aggressive or needy, never uses the 🌰 emoji as the primary brand mark, and avoids any owl, squirrel, or generic robot tropes.

### 2. Silhouette & Anatomical Rules
The `<AcornMascot />` vector system is constructed from organic rounded geometry that remains unmistakable from `16px` favicons to full hero scale:
1. **Protective Cap (`#21170F` / `#A85F2D`):** Oversized rounded dome with subtle organic cross-hatching and a soft rim that sits low like a protective beret/helmet.
2. **Asymmetrical Sprout (`#72D65C` / `#D9FF7A`):** A single curved stem with an asymmetrical leaf emerging from the upper-right crown of the cap; acts as Acorn's antenna and biological status light.
3. **Tapered Seed Body (`#E39A58` → `#A85F2D`):** Warm, softly rounded tapered base with a subtle cream belly highlight.
4. **Expressive Geometric Eyes:** Two high-contrast oval eyes nestled directly beneath the cap brim with expressive pupils and calm eyelid shutters.
5. **Minimal Limbs:** Two tiny rounded pebble-like arms and two subtle root-like feet. No fingers, no clothing.

### 3. Strongly Typed Mascot State Machine (`AcornMascotState`)

| State | Visual Pose & Anatomical Changes | Motion Behavior | Product Context |
| :--- | :--- | :--- | :--- |
| `idle` | Upright posture, relaxed arms, warm neutral eyes | 3.8s gentle breathing cycle, slow sprout sway | Default companion presence |
| `watching` | Slight forward lean (`+4deg`), eyes tracking horizon, alert sprout | Restrained concentric `--signal-300` radar rings | Hero watch state & active market monitoring |
| `thinking` | Head tilt (`-4deg`), focused upward gaze, hand near chin | 3 orbiting `--violet-400` cognitive seed particles | Conversational synthesis & role evaluation |
| `found` | Upright alert, widened bright eyes, illuminated lime sprout | Single controlled hop + luminous sprout pulse | Early opportunity signal discovery |
| `briefing` | Right arm extended presenting a miniature cream signal card | Smooth card nudge forward | Morning Briefing header & Signal presentation |
| `fitCheck` | Holding translucent resume sheet, sky-blue scanning beam | Vertical scan line across document | Fit Check & skill alignment flow |
| `privacy` | Cap lowers down over a document held close to body | Protective shelter transition | Privacy section & PII redaction preview |
| `sleepWatch` | Peaceful closed eyes, resting body, glowing sprout tip | Still body + slow luminous pulse on sprout (`#D9FF7A`) | “It works while you don't” overnight state |
| `celebrate` | Joyful arc eyes, raised tiny arms | One controlled hop + organic leaf/seed confetti specks | Role saved or preparation completed |
| `concerned` | Subtle inward brow angle, calm supportive posture | Gentle settling motion (never melodramatic) | Missing skill gap or unverified claim warning |
| `travel` | Surrounded by a luminous communication portal ring | Smooth scale/translate through portal | Acorn Everywhere cross-channel scene |

### 4. Accessibility & Reduced Motion
When `prefers-reduced-motion: reduce` is active (or toggled in `/design-system`), `<AcornMascot />` disables continuous keyframe loops and renders crisp static poses for all 11 states while preserving semantic `aria-label` descriptions.
