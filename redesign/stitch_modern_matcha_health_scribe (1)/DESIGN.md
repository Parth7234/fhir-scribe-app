---
name: Aether Clinical Design System
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#46483c'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#76786b'
  outline-variant: '#c6c8b8'
  surface-tint: '#56642b'
  primary: '#56642b'
  on-primary: '#ffffff'
  primary-container: '#8a9a5b'
  on-primary-container: '#253000'
  inverse-primary: '#bdce89'
  secondary: '#7c5637'
  on-secondary: '#ffffff'
  secondary-container: '#fecaa3'
  on-secondary-container: '#795334'
  tertiary: '#506354'
  on-tertiary: '#ffffff'
  tertiary-container: '#849887'
  on-tertiary-container: '#1e3023'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9eaa3'
  primary-fixed-dim: '#bdce89'
  on-primary-fixed: '#161f00'
  on-primary-fixed-variant: '#3e4c16'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#efbc96'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#623f22'
  tertiary-fixed: '#d3e8d5'
  tertiary-fixed-dim: '#b7ccb9'
  on-tertiary-fixed: '#0e1f13'
  on-tertiary-fixed-variant: '#394b3d'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system is centered on the concept of "Humanized Precision." It bridges the gap between high-tech AI ambient sensing and the organic nature of healthcare. The aesthetic is professional yet approachable, designed to reduce the cognitive load of clinicians.

The style leverages **Organic Minimalism** with a **Glassmorphic** overlay layer. This approach uses generous white space to signify clinical cleanliness, while frosted glass textures and soft shadows introduce a sense of depth and modernity. The UI should feel like a premium medical instrument: precise, reliable, and unobtrusive.

## Colors
The palette is inspired by natural, healing elements.
- **Primary (Matcha Green):** Used for primary actions, navigation headers, and brand moments. It conveys growth and calm.
- **Secondary (Soft Peach):** Reserved for "Live" scribe indicators, active recording states, and high-priority secondary highlights. It provides a warm contrast to the green without being alarming.
- **Neutral (Off-White):** The foundation of the UI (#FAFAFA), providing a softer, more organic reading surface than pure white.
- **Success/Warning/Error:** Use desaturated versions of standard semantic colors to maintain the "muted organic" aesthetic.

## Typography
Inter is utilized for its exceptional legibility in clinical environments. The typographic scale emphasizes hierarchy to help doctors quickly scan transcripts and patient data. 
- **Headlines:** Use SemiBold weights with slight negative letter-spacing for a modern, compact look.
- **Body Text:** Standard weight for maximum readability. Use `body-lg` for transcriptions.
- **Labels:** Medium to Bold weights for metadata and UI controls.

## Layout & Spacing
This design system utilizes a **Fixed-Fluid Hybrid** grid. 
- **Desktop:** 12-column grid with 24px gutters. Main content areas (like transcripts) should be centered with a max-width of 1200px to prevent long line lengths.
- **Mobile:** Single column with 16px side margins. 
- **Spacing Philosophy:** Emphasize vertical rhythm using multiples of 8px. Use "Generous" spacing (32px+) between major clinical sections to reduce visual noise and prevent mis-clicks in high-pressure environments.

## Elevation & Depth
Depth is created through **Glassmorphism** and soft environmental shadows.
- **Surface 1 (Base):** The #FAFAFA background.
- **Surface 2 (Glass):** White (#FFFFFF) with 70% opacity and a 20px backdrop blur. Use this for floating sidebars, headers, and modal overlays.
- **Borders:** Instead of heavy shadows, use a 1px solid border with a very low-contrast color (Matcha Green at 10% opacity) to define element boundaries.
- **Shadows:** Use a single "Ambient" shadow for cards: `0px 4px 20px rgba(138, 154, 91, 0.08)`. The slight green tint in the shadow maintains the organic feel.

## Shapes
The shape language is "Softly Geometric." 
- **Standard Radius:** 0.5rem (8px) for input fields and small buttons.
- **Large Radius:** 1rem (16px) for cards and main container sections.
- **Pill:** Used exclusively for status chips (e.g., "Active," "Finalized") and the "Record" button to make them feel tactile and distinct.

## Components
- **Buttons:** Primary buttons use a solid Matcha Green with white text. Secondary buttons use a transparent background with a Matcha Green border.
- **Live Indicator:** A Soft Peach (#FFCBA4) pill with a subtle "pulse" animation, indicating the AI scribe is currently listening.
- **Cards:** Glassmorphic backgrounds (70% white, blur) with a 1px soft border. No heavy drop shadows.
- **Input Fields:** Soft off-white fill with a 1px border that turns Matcha Green on focus.
- **Transcripts:** Use `body-lg` for the text. Speakers should be identified with Matcha Green labels. Timestamp metadata should be in `label-sm` using a muted grey-green.
- **Chips:** Small, pill-shaped tags for medical codes or keywords. Use a very light Matcha tint (#8A9A5B at 10%) with dark green text.