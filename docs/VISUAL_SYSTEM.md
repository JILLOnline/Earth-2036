# Earth 2036 — Visual System 1.2

## Purpose

Earth 2036 has one visual operating system. Routes own data and behavior; they do not own visual design. The goal is a pixel-consistent, adaptive chassis that stays coherent as data volume and page count grow.

Earth is the nucleus: the backend may be extremely deep, but the visible product must remain calm, obvious and easy to operate.

## Palette

Only these visual families may appear:

- **Black** — app foundation and negative space.
- **Diamond** — panel bodies, active/current state, selected controls, layered machine surfaces.
- **Gold** — structural borders, score/intelligence emphasis, focus lines, meaningful hierarchy.
- **Platinum** — primary and secondary readable text.

No semantic red/green/blue/etc. Status differences use wording, Diamond intensity, Platinum hierarchy and Gold structure rather than adding colors.

## Authority

- `app/globals.css` owns base geometry, palette, surfaces and canonical component anatomy.
- `app/adaptive-type.css` is the sole typography-scale authority and may override font sizing/letter spacing only; it must not invent route-specific geometry, colors or component anatomy.
- `app/interaction.css` is the sole interaction-flow authority: vertical ledger behavior, popup depth, no-horizontal-flow enforcement and interaction breakpoints.
- `app/components/Display.tsx` owns shared display primitives.
- `app/components/EarthShell.tsx` owns the global shell/header/navigation/footer.
- Route-level CSS modules are prohibited unless a future interaction cannot reasonably be expressed through the shared system. Any exception must be explicitly documented here before implementation.
- Route files may select shared class names but must not invent a parallel palette, page width, panel anatomy, bubble system, modal system, typography system or interaction system.

## Core interaction law

The application should feel like the user can do only two things:

1. **Scroll up/down to scan the current truth.**
2. **Click/tap a clear control to reveal deeper truth in a popup.**

Therefore:

- No page may require horizontal scrolling to reach decision-relevant information.
- No navigation or filter rail may require sideways scrolling.
- Dense records must collapse to a compact vertical ledger row and move secondary fields into a shared modal.
- Modals may scroll vertically when content exceeds the viewport, but must never require horizontal scrolling.
- The UI should expose only enough information on the surface to decide what deserves a click.
- Backend depth must not become frontend complexity.

## Geometry

- One application maximum width: `--page`.
- One adaptive horizontal padding token: `--pad`.
- One primary section gap token: `--gap`.
- Every route renders inside the same `Screen` geometry.
- All primary content reflows within the viewport width. Horizontal overflow is treated as a visual-system defect.

## Typography

Typography is responsive to both viewport and component width.

- Global text classes use capped `clamp()` ranges.
- Components whose text must fit their own box (`Stat`, System rows, Council timeline/roster, evidence cards) use CSS container units with hard minimum/maximum sizes.
- Text may wrap when necessary but must never escape its component.
- Dense data surfaces stay compact; typography is allowed to grow only until readability is achieved, never until it distorts layout.
- Mobile sizes are explicitly capped in the shared type layer.

## Shared anatomy

### Screen
Every route uses `Screen` and `ScreenHeader`.

### Deck
Every major surface uses `Deck` and, when labeled, `DeckHeader`.

### Stat rail
Headline operational metrics use `StatRail` / `Stat`; the grid auto-adapts to the number of real metrics.

### Bubble
A bubble exists only for status, stage, current/selected state or an explicit compact action.

Bubble contract:
- Diamond fill
- Gold border
- Platinum text

No decorative bubbles.

### Vertical ledger
Universe and Discovery use the canonical vertical ledger. A row contains only the identity and highest-value scanning fields. Secondary metadata, reasoning, evidence, sources and lineage belong in the row's popup.

### Modal
All deep disclosures share `modalBackdrop`, `modalPanel` and `modalBody`. A modal is the preferred place for secondary detail because it preserves the main vertical scan.

### Empty state
Empty content compresses. It must not reserve the same vertical area as populated content.

## System page
Machine Sources and Gating Probes are sister surfaces and use identical row anatomy. Earth Council uses one timeline plus one compact roster. Evidence Queue compresses when empty and expands only when records exist.

## Universe
Live, Championship, Contenders and frozen period cohorts use one vertical ledger. Top-3 visual emphasis appears only for earned official/frozen ranks. The surface carries rank, identity, Earth score, confidence/risk, stage and one Details action; exchange, division, state and decision reasoning move into the shared popup.

## Discovery
Discovery uses the same vertical ledger language as Universe. A challenger surface row carries identity, stage, confidence, a short evidence digest, admission state and one Details action. Full evidence, metadata and every source live together in the popup.

## Company intelligence
Company pages use the same decks, stat rails, grids, list rhythm, disclosure density and color contract. Company intelligence remains a vertical reading experience; deeper information may expand or disclose, but the chassis does not change and horizontal movement is prohibited.

## Adaptive behavior
Canonical base geometry lives in `globals.css`; typography caps live in `adaptive-type.css`; interaction/reflow rules live in `interaction.css`.

- Desktop: full header and compact one-line ledgers where width allows.
- Mid-size: ledger fields reorganize before they become cramped.
- Mobile: navigation and filters wrap into grids, stats compact, system rows stack, ledger rows reflow downward, and detail stays in popups.
- At no breakpoint should a user need to swipe sideways to operate Earth.

## Data rule
The visual system may not create decorative or placeholder information. If canonical data is unknown, display `—`, `PENDING`, `LOCKED`, or another truthful state.

## Change rule
Before adding a new visual pattern, ask:

1. Can an existing shared primitive express it?
2. Is the difference driven by the data/interaction or merely by the route?
3. Can the interaction remain vertical-only on desktop, tablet and mobile?
4. Can secondary depth move into the existing popup system?
5. Can the typography fit inside the existing component without changing its geometry?

If the difference is only route identity, do not add it.
