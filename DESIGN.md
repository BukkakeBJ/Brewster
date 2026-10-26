# BrewMaster visual design — field journal edition

The second visual direction was developed in [Canva's mobile concept](https://canva.link/zqq6wfgvcf9vskh), design `DAHZIKkTWZE`, on October 26, 2026. It develops the earlier [craft workbench concept](https://canva.link/zzd73gq0khzrtc9) into a more distinctive illustrated brewer's journal. Both concepts were visually reviewed through Canva-provided thumbnails. The browser uses a separate Canva login; the editable designs belong to the connected Canva account. No account permissions were changed.

## Identity and artwork

The original mark combines a plump, slanted hop cone built from pointed overlapping bracts with a separate awned barley ear, joined by intertwined stems. The hop silhouette was revised using the user’s supplied cone photograph as a shape reference; the photograph itself is not included in the app. `src/components/BrandMark.tsx` is the inline vector mark used in the header, sidebar, Recipe Book artwork and footer. `public/brewmaster-mark.svg` is its standalone icon version and the app favicon. This is authored SVG artwork; it remains crisp at any size and needs no external images or fonts.

`BrewArtwork.tsx` contains original botanical and brewing illustrations: an amber pint with foam and a circular stamp, the hop/barley study, and a brewer's recipe journal. `StudioHero.tsx` gives each screen its own editorial headline, illustration and caption. The recipe illustration's beer color responds to calculated SRM, but it remains decorative; use the explicitly labeled SRM swatch for the numeric color estimate.

Recipe Book cards have original beer-label compositions using the style name, brewery attribution and calculated ABV from the recipe data. These are BrewMaster illustrations, **not official brewery packaging**. Rotating label palettes are decorative, not indicators of style, flavor or measured beer color. The actual SRM color swatch remains separate. No brewery logos or marketing artwork are copied.

## Visual system

- Oat paper `#f2eddf`, cream cards `#fffcf3`, and a subtle repeating dot texture.
- Forest navigation `#163a31`, dark green numeric instrument panel `#244b3c`.
- Copper italic headlines `#a66035`, pale citron/ochre accents, fine botanical rules.
- System sans-serif for controls, Georgia for editorial headings and recipe names.
- Flat offset shadows, small corners on working forms, circular stamps on artwork.

Calculated specifications and subjective flavor estimates retain their explicit text labels and separate green/amber treatments. Illustrative mock values from Canva are not used in production; recipe numbers continue to come from the deterministic engine.

`src/styles.css` remains the structural foundation, `src/theme.css` supplies common control colors/readability, and `src/studio.css` supplies this edition's layout and artwork styling.

## Mobile and working layout

The phone layout has a compact sticky brand header, top-right Metric/Imperial switch and a floating five-screen bottom navigation with safe-area spacing. Page content reserves bottom space so the navigation cannot cover the last controls. Active navigation uses `aria-current="page"`. The narrow layout was checked at a 409 px content viewport; desktop at 1265 px. All five screens fit without horizontal overflow at those widths.

The recipe's working numbers now appear directly after its editable name, before notes and secondary tools. The water planner is a clearly labeled expandable row, **Start with your water**, retaining the default 5 US gallons and a preview before applying. Expanding it exposes all existing absorption, packaging, bottle and yeast planning controls. Recipe notes, exports and live calculations remain available. Decorative headers and label artwork are omitted from brew-sheet printing, and reduced-motion preferences remain respected.

UI checks covered screen switching, correct active navigation, water planner expansion/defaults, and mobile recipe/specification visibility. Existing engine and data tests still cover actual brewing behavior. No recipe amounts, chosen ingredients, saved notes or database records are changed by this visual redesign.

## Screenshot proof

Actual running-app captures are saved under `.runtime/`: `mobile-studio-recipe.png`, `mobile-studio-numbers.png`, `mobile-studio-design.png`, `mobile-studio-book.png`, `mobile-studio-library.png`, `mobile-studio-log.png` and `studio-desktop.png`. They are UI screenshots, not Canva mockups.
