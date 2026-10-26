# BrewMaster visual design

Canva concept: [BrewMaster Recipe Editor](https://canva.link/zzd73gq0khzrtc9), design ID `DAHZIHiSgCI`, created October 26, 2026 through the Canva connector. One landscape editable UI concept was generated and visually reviewed via its Canva thumbnail. The browser's separate Canva login did not have access; the linked design belongs to the connected Canva account. No permissions were changed or access requests sent.

The implementation interprets the concept as a responsive workbench rather than reproducing its illustrative numbers or static layout. Canva's sample recipe amounts, water budget and radar values are decorative mock content; actual app calculations continue to come from the existing engine. No Canva image is required at runtime.

## Direction

Dark evergreen navigation, warm ivory content, cream cards, restrained amber accents, serif headlines and ingredient names, readable sans-serif form labels, subtle borders and soft shadows. Selected navigation has a warm cream treatment. The primary recipe save action uses amber; general workbench actions use evergreen. The brand now reads BrewMaster.

## Tokens

- Ink and primary action: `#183c34`
- Sidebar: `#112e28`
- Page: `#f5f2e9`
- Card: `#fffefa`
- Border: `#deded0`
- Secondary text: `#627168`
- Amber accent: `#a86822`
- Save action: `#dfb368`
- Calculated/specification tint: green `#e9f0e5`
- Sensory estimate tint: amber `#faedcf`

Text labels continue to distinguish objective specs/calculations from subjective flavor estimates; color is an additional cue. Local system sans-serif and Georgia avoid external font requests and keep the app available offline. Cards use 11–13 px radii, fields 7 px, and controls have visible keyboard focus. Motion is disabled when reduced motion is preferred.

## Responsive behavior

Desktop retains the fixed sidebar, compact top bar and multi-column workbench. Mobile has a sticky five-screen navigation bar, top-right Metric/Imperial controls, stacked forms and responsive metric cards. At narrow widths the decorative heading emblem is removed to give content space. Print rules retain clean, unshadowed cards and existing brew-sheet behavior.

`src/theme.css` provides the visual layer after the existing structural styles. Recipe editing, engine calculations, library filtering, notes, exports, local storage and SQLite data are unchanged. No ingredient selections or recipe values are altered by this redesign.
