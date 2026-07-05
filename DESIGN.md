---
name: Neo-Kyoto Dual
colors:
  surface: '#f9f9fe'
  surface-dim: '#d9dade'
  surface-bright: '#f9f9fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f8'
  surface-container: '#ededf2'
  surface-container-high: '#e8e8ed'
  surface-container-highest: '#e2e2e7'
  on-surface: '#1a1c1f'
  on-surface-variant: '#464554'
  inverse-surface: '#2e3034'
  inverse-on-surface: '#f0f0f5'
  outline: '#777586'
  outline-variant: '#c7c4d7'
  surface-tint: '#4d4ad5'
  primary: '#4441cc'
  on-primary: '#ffffff'
  primary-container: '#5e5ce6'
  on-primary-container: '#f4f1ff'
  inverse-primary: '#c2c1ff'
  secondary: '#006b5f'
  on-secondary: '#ffffff'
  secondary-container: '#2bfde4'
  on-secondary-container: '#007165'
  tertiary: '#565658'
  on-tertiary: '#ffffff'
  tertiary-container: '#6f6e70'
  on-tertiary-container: '#f5f2f4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c2c1ff'
  on-primary-fixed: '#0c006b'
  on-primary-fixed-variant: '#332dbc'
  secondary-fixed: '#2bfde4'
  secondary-fixed-dim: '#00dec8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005047'
  tertiary-fixed: '#e4e2e4'
  tertiary-fixed-dim: '#c8c6c8'
  on-tertiary-fixed: '#1b1b1d'
  on-tertiary-fixed-variant: '#474649'
  background: '#f9f9fe'
  on-background: '#1a1c1f'
  surface-variant: '#e2e2e7'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
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
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style

The design system is a fusion of high-tech "Cyberpunk" aesthetics and clean, systematic modernism. It is designed to evoke a sense of digital precision, youthful energy, and high performance. This iteration prioritizes a **Light Mode** experience, offering a professional, high-contrast interface that remains functional and crisp in all lighting conditions.

The visual style is **Corporate / Modern** with a **Neon-Futuristic** twist. It utilizes expansive whitespace, sharp grid layouts, and vibrant, luminous accents. By day, it is a professional, clean interface; its technical soul is expressed through geometric precision and high-energy color hits that reflect the neon-lit streets of a future Kyoto.

## Colors

The color palette is built on a "Dual-State" logic, now optimized for light backgrounds.

- **Primary & Secondary:** Vibrant Purple (#5e5ce6) and Aqua Green (#00f2da) are extracted directly from the brand mark. Purple serves as the primary action color for buttons and selection states, while Aqua Green acts as a high-visibility accent for success states and secondary highlights.
- **Surface Scale:** A custom scale of **Light Grays and Off-Whites** (#f2f2f7) ensures the UI feels clean and modern. Surfaces use subtle slate-blue strokes to define hierarchy without the weight of dark mode backgrounds.
- **Neon Accents:** In Light Mode, neon effects are applied with higher saturation and precision, often used as thin borders or active state indicators to maintain the tech-focused identity.

## Typography

This design system employs a pairing that balances technical precision with high readability. 

**Space Grotesk** is used for all headings and display text. Its geometric quirks and "tech" feel reinforce the digital-first nature of the brand. For long-form reading, data tables, and user inputs, **Inter** provides a neutral, highly legible foundation that works exceptionally well against light, high-density layouts. 

Heading weights should remain semi-bold to bold to maintain visual weight, while body text prioritizes the 400-500 weight range for maximum clarity.

## Layout & Spacing

The layout is based on a **12-column fluid grid** for desktop and a **4-column grid** for mobile. We utilize an 8px base unit to maintain a rigorous mathematical rhythm.

- **Grid:** Use a 24px gutter to provide significant breathing room between "grid modules," echoing the tiled nature of the brand logo.
- **Safe Areas:** Large external margins (64px on desktop) focus the user's attention on the central content "grid." 
- **Reflow:** On mobile, content cards should span the full width of the 4-column grid, while navigation is consolidated into a bottom bar to maintain accessibility.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Subtle Shadows** rather than the glowing luminescence found in dark environments.

- **Light Mode Depth:** Surfaces are elevated by using progressively brighter shades of white against a light gray base. Level 0 is the background (#f2f2f7); Level 1 is for primary cards (Pure White); Level 2 is for modals/popovers.
- **The Shadow Effect:** Uses thin, low-contrast outlines and soft ambient shadows with a hint of blue tinting to prevent the UI from feeling "flat" or "cheap."
- **Interactive States:** Active elements may utilize a subtle primary-colored glow or a high-contrast border to signal focus.

## Shapes

The defining characteristic of the shape language is the **Rounded** (0.5rem/8px base) radius. This rounding creates a friendly, approachable contrast to the sharp, technical Space Grotesk typography.

All primary containers, cards, and buttons must adhere to this standard. Larger containers like cards should use a proportional 16px or 24px radius to maintain visual harmony. Small elements like image tiles may maintain a slight 4px radius to echo the pixel-tiles found in the brand mark.

## Components

- **Buttons:** Primary buttons use a solid Vibrant Purple fill. In Light Mode, they provide a high-contrast focal point. Buttons must use the standard 8px rounding.
- **Cards:** Cards use a pure white background with a subtle 1px stroke. They may feature a "Glass" variant (white fill with high transparency and backdrop blur).
- **Inputs:** Input fields use a "Ghost" style—light gray background with a Slate-Blue bottom border. Upon focus, they animate into a full-bordered element with a Vibrant Purple stroke.
- **Chips/Badges:** Use Aqua Green for "Live" or "Active" indicators. Use high-contrast Slate or charcoal for metadata.
- **The Grid:** Whenever possible, use a visible 1px grid in the background of sections to reinforce the "AnimeGrid" identity, using a very low-opacity Slate Blue.