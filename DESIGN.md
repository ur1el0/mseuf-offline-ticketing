---
name: MSEUF Events Offline Ticketing System - Design System
description: Institutional, high-contrast offline ticketing dashboard and mobile design system for Manuel S. Enverga University Foundation
colors:
  primary: "#481c1c"
  primary-deep: "#1c0808"
  accent-saffron: "#ffcb2f"
  status-green: "#20823a"
  status-amber: "#e8a72d"
  status-red: "#b34335"
  neutral-bg: "#f4f1ef"
  neutral-surface: "#ffffff"
  neutral-border: "#eadfdd"
  neutral-text: "#2a1010"
  neutral-muted: "#806c68"
typography:
  display:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(25px, 2vw, 32px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-.055em"
  body:
    fontFamily: "Quicksand, Nunito Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Quicksand, Nunito Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.13em"
rounded:
  sm: "12px"
  md: "16px"
  lg: "20px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "15px"
  lg: "22px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  card-surface:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.lg}"
    padding: "19px"
---

# Design System: MSEUF Events Offline Ticketing System

## Overview

**Creative North Star: "The Sentinel Sanctuary"**

The MSEUF Offline Ticketing design system balances institutional authority with high-throughput operational clarity. Rooted in Manuel S. Enverga University Foundation's heritage, the interface marries deep obsidian maroon and metallic saffron gold accents with accessible, high-contrast surfaces. It is crafted specifically for high-stress event environments—such as crowded venue gates, outdoor stadiums during foundation week, and real-time administrative monitoring centers.

The visual language avoids generic cold tech aesthetics in favor of warm, tactile surfaces, rounded organic shapes (16px to 20px radii), and unambiguous color-coded status badges that remain readable under harsh sunlight or indoor stadium lighting.

**Key Characteristics:**
- **Institutional Dignity:** Deep Maroon (`#481c1c`) and Saffron Gold (`#ffcb2f`) identity hierarchy.
- **High-Readability Telemetry:** Micro-eyebrows with uppercase letter-spacing (`.13em`) paired with high-impact numbers.
- **Unambiguous Status Color:** Color coding reserved strictly for state verification (Emerald = Valid, Amber = Override/Warning, Crimson = Collision Anomaly).
- **Tactile Softness:** Soft ambient shadows (`box-shadow: 0 8px 28px rgb(42 16 16 / 4%)`) paired with explicit 1px surface borders (`#eadfdd`).

---

## Colors

The palette is grouped into distinct institutional, status, and canvas surfaces.

### Primary
- **Obsidian Maroon** (`#481c1c` / `#1c0808`): Defines the authoritative sidebar, navigation anchors, primary buttons, and structural headers.

### Secondary / Accent
- **Saffron Gold** (`#ffcb2f` / `#e3a91c`): The MSEUF institutional accent. Used sparingly on active navigation indicators, focus rings, brand lockups, and high-importance highlights.

### Status & Telemetry
- **Admission Emerald** (`#20823a` / `#2bb879`): Indicates valid offline scans, active connections, and successful sync processing.
- **Override Amber** (`#e8a72d` / `#fff2d5`): Indicates PIN-authenticated marshal overrides and warning states.
- **Collision Crimson** (`#b34335` / `#fff0ed`): Highlights split-brain double-scan anomalies, gate mismatches, and severe security alerts.

### Neutral
- **Warm Canvas** (`#f4f1ef`): Main application background providing warm contrast without harsh white glare.
- **Card Surface** (`#ffffff`): Pure white elevated containers for metric panels and data lists.
- **Subtle Border** (`#eadfdd`): Defines clear spatial boundaries between cards and tables.
- **Text Primary** (`#2a1010`): Deep warm black for maximum typographic contrast.
- **Text Muted** (`#806c68`): Secondary label text and telemetry metadata.

### Named Rules
**The Rarity of Gold Rule.** Saffron Gold (`#ffcb2f`) is used on $\le 10\%$ of any given screen. Its rarity maintains its visual authority as the primary interactive focus anchor.

---

## Typography

**Interface Font:** `Quicksand` (fallback `system-ui`, `sans-serif`)

**Header Font:** `Barlow` (fallback `system-ui`, `sans-serif`)

### Hierarchy
- **Display** (Barlow Bold 700, `clamp(25px, 2vw, 32px)`, line-height `1.15`, `-0.055em` letter-spacing): Page titles and primary dashboard headers.
- **Headline** (Barlow Bold 700, `16px`, line-height `1.2`, `-0.03em` letter-spacing): Panel section headers and modal titles.
- **Title** (Barlow Bold 700, `clamp(22px, 2.2vw, 29px)`, line-height `1.1`): Metric card values and quantitative counts.
- **Body** (Medium 500, `14px`, line-height `1.5`): Standard UI text, table rows, and description copy.
- **Label** (Bold 700, `10px`–`11px`, letter-spacing `0.13em`, uppercase): Micro-eyebrows, status badges, and table headers.

### Named Rules
**The Micro-Eyebrow Rule.** Every quantitative metric value must be preceded by a 10px uppercase eyebrow in bold muted text with `letter-spacing: 0.13em`.

---

## Layout

The Web Admin Dashboard layout operates on a 2-column spatial grid:
- **Fixed Sidebar:** `256px` width, full viewport height (`min-height: 100vh`), anchored in Obsidian Maroon (`#1c0808`).
- **Fluid Main Canvas:** Fluid responsive container (`min-width: 0`), padded dynamically with `clamp(22px, 3.3vw, 54px)` horizontally and `34px` vertically.
- **Metrics Grid:** 4-column responsive grid (`repeat(4, minmax(0, 1fr))`) for top-level operational counters.
- **Panels Grid:** Asymmetric 2-column layout (`1.7fr` throughput panel vs `0.95fr` side activity/override panel).

---

## Elevation & Depth

The system uses flat, tactile tonal layering with soft ambient elevation:
- **Surface Elevation:** Cards use `background: #ffffff`, `border: 1px solid #eadfdd`, and `box-shadow: 0 8px 28px rgb(42 16 16 / 4%)`.
- **Interactive Lift:** Interactive buttons and cards apply a `-1px` Y-axis translation on hover (`transform: translateY(-1px)`).
- **Focus Depth:** Inputs and buttons emit a crisp Saffron Gold focus ring (`outline: 3px solid #e3a91c; outline-offset: 3px`).

### Named Rules
**The Tactile Border Rule.** Surfaces are never defined by shadow alone. Every white card must be bounded by a 1px `#eadfdd` border to preserve structural clarity across display screens.

---

## Shapes

- **Surface Card Radius:** `20px` (`border-radius: 20px`) for major metric cards, throughput panels, and modals.
- **Nav & Button Radius:** `16px` for navigation links, primary buttons, and input fields.
- **Avatar & Icon Bubble Radius:** `13px`–`14px` for square metric icon containers and user avatars.
- **Pill Radius:** `999px` for status badges, connection indicator pills, and scope tags.

---

## Components

### Buttons
- **Shape:** `16px` border-radius (`rounded-md`).
- **Primary:** Background `#481c1c`, Text `#ffffff`, Padding `12px 24px`, Font Weight `700`. Hover state transitions to `#1c0808`.
- **Icon Button:** `38px x 38px`, Background `#f2eae7`, Text `#5b3030`. Hover transitions to `#e9ddd9` with `-1px` lift.

### Metric Cards
- **Shape:** `20px` corner radius, `19px` internal padding, `background: #ffffff`, `border: 1px solid #eadfdd`.
- **Content:** Top row with 11px label and 34px colored icon bubble; center row with 29px bold metric number; bottom note in 10px muted text.

### Status Pills
- **Style:** Height `42px` (or `28px` compact), inline-flex alignment, `border-radius: 999px`, font weight `700`, `11px` size.
- **Valid (Green):** Background `#e6f5eb`, Text `#177545`, Dot `#2bb879`.
- **Warning / Override (Amber):** Background `#fff2d5`, Text `#8b5b0b`, Dot `#e8a72d`.

### Navigation Items
- **Inactive:** Height `50px`, Padding `0 13px`, Text `#e9dfdd`, Background transparent, `16px` radius.
- **Active:** Text `#ffcb2f`, Background `#351413`, Inner Border `1px solid rgb(255 203 47 / 9%)`.

---

## Do's and Don'ts

### Do:
- **Do** pair every quantitative metric card with an explicit uppercase eyebrow label (`10px`, `letter-spacing: .13em`).
- **Do** use Saffron Gold (`#ffcb2f`) strictly for interactive focus, active navigation, and key brand accents.
- **Do** maintain a strict 20px corner radius on all major panel cards.
- **Do** use high-contrast color badges (Emerald, Amber, Crimson) for instant status diagnostics.

### Don't:
- **Don't** use raw harsh black (`#000000`) for text or backgrounds; use Obsidian Maroon (`#1c0808`) and Warm Slate (`#2a1010`).
- **Don't** remove the 1px subtle border (`#eadfdd`) from card containers.
- **Don't** use WebSockets or unverified live push socket connections on the Web Admin Dashboard; rely on deterministic HTTP polling against `/api/v1/admin/metrics`.
- **Don't** use sharp square corners (0px radius) on primary buttons or containers.
