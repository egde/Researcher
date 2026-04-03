# Design System

## Aesthetic

Minimalist, academic, content-dense. Think LaTeX research papers meets Bloomberg terminal. No decorative elements, maximum information density, everything earns its place.

## Typography

- **Font**: JetBrains Mono (monospace) everywhere — body, headings, nav, UI. Falls back to system monospace (`ui-monospace`, `Cascadia Code`, `Source Code Pro`, `Menlo`, `Consolas`).
- **Body**: 14px base, line-height 1.7
- **Headings**: Weight variations only (700/600/500), modest scale ratio (~1.2). No decorative sizing.
- **Labels**: 10-11px, uppercase, letter-spacing 0.05em

## Color Palette

Color is signal. Everything else is black, white, or gray.

| Token | Hex | Usage |
|-------|-----|-------|
| `foreground` | `#000000` | All text, borders, icons |
| `background` | `#ffffff` | Page background |
| `surface` | `#fafafa` | Card/section backgrounds |
| `muted` | `#666666` | Metadata, timestamps, secondary text |
| `border` | `#e5e5e5` | Dividers, light borders |
| `border-strong` | `#000000` | Emphasis borders |
| `error` | `#dc2626` | Errors, destructive actions |
| `warning` | `#d97706` | Warnings, pending states |
| `success` | `#16a34a` | Success confirmations |
| `link` | `#2563eb` | Hyperlinks only (always underlined) |

These are defined as CSS custom properties in `src/app/globals.css` via Tailwind v4's `@theme inline` block.

## Component Patterns

### Buttons

```
Primary:   bg-foreground text-background, uppercase, tracking-wider
Secondary: border border-foreground, uppercase
Ghost:     text only, hover opacity
```

No rounded corners. 2px border-radius max on inputs/buttons.

### Badges

```
Outline:  border border-foreground — for categories, types
Solid:    bg-foreground text-background — for emphasis, internal content
Muted:    border border-border text-muted — for tags, metadata
```

All badges: 10px, uppercase, letter-spaced.

### Source Badges

External content (Databricks): outlined badge reading "EXTERNAL"
Internal content (web editor): solid badge reading "INTERNAL"
Research notes (Obsidian): solid badge reading "RESEARCH"

### Cards

White background, 1px black border, no shadow, no border-radius.

### Tables

First-class citizens. Thin 1px gridlines, uppercase column headers at 11px, 6px/10px cell padding. Used for financial data, company listings, vote breakdowns.

### Conviction Scale

Rendered as filled/unfilled circles: `●●●○○` (3 of 5). Not colored stars.

### Navigation

Clean horizontal top bar. Active page indicated by underline, not highlight. All text labels, no icon-only buttons.

### Loading States

Pulsing underscores (`___`) with CSS animation. No spinners, no skeleton screens.

## Layout Principles

- **Content-first**: Maximum width for reading. No permanent sidebar.
- **Borders over backgrounds**: Sections separated by 1px borders, not colored blocks.
- **No rounded corners**: Sharp rectangles on all containers. Academic feel.
- **Dense but scannable**: Tight spacing, hierarchy via weight and size, not color.
- **No icons where text works**: Text labels preferred. Icons only for universals (search, close).

## Tailwind v4 Configuration

Design tokens are defined in `globals.css`, not `tailwind.config.ts`:

```css
@theme inline {
  --color-background: #ffffff;
  --color-foreground: #000000;
  --color-muted: #666666;
  --color-border: #e5e5e5;
  --color-border-strong: #000000;
  --color-surface: #fafafa;
  --color-error: #dc2626;
  --color-warning: #d97706;
  --color-success: #16a34a;
  --color-link: #2563eb;
  --font-mono: "JetBrains Mono", ui-monospace, ...;
}
```

These are usable as Tailwind classes: `text-muted`, `border-border`, `bg-surface`, etc.
