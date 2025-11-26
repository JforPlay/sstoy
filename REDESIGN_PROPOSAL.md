# 🎨 Mainpage Redesign Proposal

## Color Scheme - Pastel Sky Theme

### Light Mode (White Base with Green/Blue Accents)
```css
--primary-green: #10b981;      /* Emerald green - main CTA */
--primary-blue: #3b82f6;       /* Sky blue - secondary CTA */
--accent-teal: #14b8a6;        /* Teal - highlights */
--accent-sky: #0ea5e9;         /* Bright sky - accents */

--bg-primary: #ffffff;         /* Pure white background */
--bg-secondary: #f0fdfa;       /* Mint tint - cards */
--bg-tertiary: #ecfeff;        /* Sky tint - hover states */

--text-primary: #0f172a;       /* Dark slate - headings */
--text-secondary: #475569;     /* Medium slate - body */
--text-muted: #94a3b8;         /* Light slate - captions */

--border-light: #e0f2fe;       /* Sky border */
--border-medium: #a5f3fc;      /* Cyan border */

--shadow-soft: 0 4px 20px rgba(59, 130, 246, 0.08);
--shadow-glow: 0 8px 32px rgba(16, 185, 129, 0.12);
```

### Dark Mode (Deep Sky/Night Theme)
```css
--primary-green: #34d399;      /* Brighter emerald */
--primary-blue: #60a5fa;       /* Brighter sky blue */
--accent-teal: #2dd4bf;        /* Bright teal */
--accent-sky: #38bdf8;         /* Bright cyan */

--bg-primary: #0c1222;         /* Deep midnight blue */
--bg-secondary: #1e293b;       /* Slate card background */
--bg-tertiary: #334155;        /* Lighter slate - hover */

--text-primary: #f1f5f9;       /* Almost white */
--text-secondary: #cbd5e1;     /* Light gray */
--text-muted: #94a3b8;         /* Medium gray */

--border-light: #1e3a5f;       /* Dark blue border */
--border-medium: #2563eb;      /* Blue border */

--shadow-soft: 0 4px 20px rgba(16, 185, 129, 0.15);
--shadow-glow: 0 8px 32px rgba(59, 130, 246, 0.2);
```

## Layout Design Concepts

### Option 1: Modern Hero + Feature Grid
```
┌─────────────────────────────────────────────┐
│  [Theme] [Lang]                             │
│                                             │
│           🌟 STELLA SORA TOOLS              │
│        Build. Optimize. Dominate.          │
│                                             │
│    [Start Building →] [View Characters]    │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │  🏺       │ │  📖       │ │  💿       │ │
│  │ Builder   │ │Characters│ │  Discs    │ │
│  │ Featured  │ │ Database │ │ Database  │ │
│  └───────────┘ └───────────┘ └───────────┘ │
│                                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │  📊       │ │  🎯       │ │  💎       │ │
│  │ Summary   │ │ Tasks     │ │Resources │ │
│  │Highlight! │ │ Helper    │ │Calculator│ │
│  └───────────┘ └───────────┘ └───────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

### Option 2: Bento Grid (Modern)
```
┌─────────────────────────────────────────────┐
│                                             │
│  ┌────────────────┐  ┌──────┐  ┌─────────┐ │
│  │                │  │Theme │  │  Lang   │ │
│  │  🌟 Hero       │  └──────┘  └─────────┘ │
│  │  Large Card    │                        │
│  │  + CTA         │  ┌──────────────────┐  │
│  │                │  │ ✨ BUILD SUMMARY │  │
│  └────────────────┘  │   Featured!      │  │
│                      │  [Preview]       │  │
│  ┌──────┐ ┌──────┐  └──────────────────┘  │
│  │ Char │ │ Disc │                        │
│  │  DB  │ │  DB  │  ┌──────┐  ┌─────────┐ │
│  └──────┘ └──────┘  │Tasks │  │Resource │ │
│                      └──────┘  └─────────┘ │
└─────────────────────────────────────────────┘
```

### Option 3: App-Centric Hero
```
┌─────────────────────────────────────────────┐
│                 [Theme] [Lang]              │
│                                             │
│         🎯 OPTIMIZE YOUR BUILD              │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │   📊 BUILD SUMMARY PREVIEW          │   │
│  │   ┌───┬───┬───┐                    │   │
│  │   │ M │A1 │A2 │ [Your build here]  │   │
│  │   └───┴───┴───┘                    │   │
│  │   Potentials: ⭐⭐⭐               │   │
│  │   Rank: S                           │   │
│  │                                     │   │
│  │   [Start Building →]                │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Quick Access:                              │
│  [Characters] [Discs] [Tasks] [Resources]  │
│                                             │
└─────────────────────────────────────────────┘
```

## Design Elements

### Glassmorphism Cards
- Semi-transparent backgrounds
- Backdrop blur effects
- Subtle borders with gradients
- Soft shadows with colored glows

### Animated Features
- Hover lift effects on cards
- Gradient text animations
- Smooth color transitions
- Floating elements (subtle)

### Featured Summary Section
- Large preview card showing build summary example
- Live stats display
- Character portraits in grid
- Rank badge with animation
- "Try it now" CTA button

## Recommended: Option 2 (Bento Grid)

**Why this works best:**
1. Modern, trendy layout (popularized by Apple, iOS)
2. Can emphasize the summary feature with a larger card
3. Asymmetric design feels more dynamic
4. Easy to scan and navigate
5. Works great on mobile (stacks vertically)

**Implementation:**
- Use CSS Grid with different sized cells
- Summary feature gets 2x2 grid space
- Other features get 1x1 space
- Responsive breakpoints for mobile

Would you like me to implement one of these options?
