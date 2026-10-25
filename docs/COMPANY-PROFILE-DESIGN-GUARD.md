# Company Profile Design Guard

## Purpose

Define the minimum design and responsive requirements for a company profile website
before implementation begins. The guard is owned by Product Design for visual
decisions, Codex for requirements, and QA for evidence.

## Product scope

The default target is a single-page, public, responsive company profile with:

- clear company identity and value proposition;
- hero section with a primary call to action;
- services or capabilities;
- selected work, projects, or proof;
- about or trust section;
- contact path, such as WhatsApp, phone, email, or form;
- footer with required business and legal links.

Unknown business facts, names, claims, years, statistics, testimonials, and contact
details remain placeholders until supplied. Agents must not invent them.

## Responsive contract

Use mobile-first, fluid layout. Breakpoints are content-driven rather than
device-specific:

- base: 320 CSS px and above;
- `min-width: 640px`: large mobile or small tablet;
- `min-width: 768px`: tablet layout;
- `min-width: 1024px`: desktop layout;
- `min-width: 1280px`: wide-screen spacing only, not unlimited content width.

Verify at these viewports:

`320x800`, `360x800`, `390x844`, `414x896`, `768x1024`,
`1024x768`, `1280x800`, `1440x900`, and `1920x1080`.

The page must:

- include `<meta name="viewport" content="width=device-width, initial-scale=1">`;
- have no horizontal overflow or two-dimensional page scrolling;
- preserve information and primary actions at 320 CSS px;
- support portrait and landscape where the layout has meaningful orientation changes;
- keep content within a readable max-width, normally 1200px;
- use fluid typography and spacing where helpful;
- keep images inside their containers and reserve their aspect-ratio space;
- use responsive image sources or art direction when a crop must change by layout.

## Interaction and accessibility guard

- Primary controls must work with touch, keyboard, and visible focus.
- Pointer targets must meet at least 24x24 CSS px; primary mobile actions should
  target approximately 44x44 CSS px.
- Do not make essential information or actions depend on hover.
- Text and controls must remain usable at 200% zoom; reflow must remain usable
  at the equivalent of 320 CSS px.
- Respect `prefers-reduced-motion` for non-essential animation.
- Use semantic headings, landmarks, link names, image alt text, and form labels.
- Do not use image text for editable or essential page content.

## Visual quality gate

Product Design must provide:

1. one selected visual direction;
2. desktop and mobile states;
3. a section map and primary user action;
4. typography, color, spacing, and image guidance;
5. states for navigation and primary interactions;
6. known content placeholders and unresolved questions.

No implementation starts for a new design until a visual direction is selected.
Product Design may prototype; the developer owns production implementation.

## Acceptance criteria

- [ ] At 320px, all content and primary actions remain available without horizontal scrolling.
- [ ] At 390px, hero, navigation, proof, and contact CTA are readable and usable.
- [ ] At 768px, layout changes do not create clipped content or awkward empty columns.
- [ ] At 1024px and 1440px, content remains centered and readable rather than stretching indefinitely.
- [ ] At 1920px, no section becomes visually broken because of excess width.
- [ ] Images do not overflow, distort, or cause layout shift.
- [ ] Keyboard focus is visible and the primary journey is operable without a mouse.
- [ ] Primary pointer targets meet the minimum size rule.
- [ ] No unsupported business claim is presented as fact.
- [ ] Console errors, broken images, and critical interaction failures are absent.
- [ ] QA records evidence for every checked viewport and criterion.

## Handoff contract

```md
Selected direction:
Design source:
Page sections:
Primary user action:
Responsive decisions:
Content placeholders:
Known limitations:
Developer handoff:
QA checks:
```
