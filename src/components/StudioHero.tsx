import type { Catalog, Prediction } from "../engine/types";
import { beerColor } from "../engine/calculations";
import BrewArtwork from "./BrewArtwork";
const screens: Record<
  string,
  {
    line: string;
    emphasis: string;
    kicker: string;
    description: string;
    note: string;
    variant: "glass" | "botanical" | "book";
  }
> = {
  "Recipe Editor": {
    line: "Good things",
    emphasis: "are brewing.",
    kicker: "01 / THE RECIPE WORKSHOP",
    description:
      "A little precision. A little instinct. A beer that’s entirely yours.",
    note: "FORMULATE / REFINE / BREW",
    variant: "glass",
  },
  Design: {
    line: "Dream it.",
    emphasis: "Brew it.",
    kicker: "02 / FROM IDEA TO FIRST POUR",
    description:
      "Find the recipe behind the flavor in your head. We’ll help with the numbers.",
    note: "YOUR TASTE. YOUR NEXT EXPERIMENT.",
    variant: "glass",
  },
  "Ingredient Library": {
    line: "Small ingredients.",
    emphasis: "Endless possibility.",
    kicker: "03 / THE INGREDIENT FIELD GUIDE",
    description:
      "Get to know the grains, hops and cultures that make a beer your own.",
    note: "SPECIFICATIONS + SENSORY STORIES",
    variant: "botanical",
  },
  "Recipe Book": {
    line: "A collection",
    emphasis: "worth brewing.",
    kicker: "04 / THE BREWER’S COLLECTION",
    description:
      "Craft favorites, curious experiments and the recipes you’ll come back to.",
    note: "GOOD RECIPES DESERVE ANOTHER POUR.",
    variant: "book",
  },
  "Brew Log": {
    line: "Every batch",
    emphasis: "tells a story.",
    kicker: "05 / NOTES FROM THE BREWHOUSE",
    description:
      "Record the numbers. Remember the flavor. Make the next batch even better.",
    note: "OBSERVE / TASTE / MAKE IT YOURS",
    variant: "book",
  },
};
export default function StudioHero({
  screen,
  catalog,
  prediction,
}: {
  screen: string;
  catalog: Catalog;
  prediction?: Prediction;
}) {
  const copy = screens[screen] ?? screens["Recipe Editor"];
  return (
    <section
      className={`studio-hero studio-hero-${screen.toLowerCase().replaceAll(" ", "-")}`}
      aria-label={screen}
    >
      <div className="studio-hero-copy">
        <div className="studio-kicker">
          <span />
          {copy.kicker}
        </div>
        <h1 className="mobile-screen-title">{screen}</h1>
        <h1 id="studio-heading" className="studio-editorial-title">
          {copy.line} <em>{copy.emphasis}</em>
        </h1>
        <p>{copy.description}</p>
        <div className="studio-footnote">
          <i />
          {screen === "Ingredient Library"
            ? `${catalog.hops.length} HOPS · ${catalog.malts.length} FERMENTABLES · ${catalog.yeasts.length} YEASTS`
            : copy.note}
        </div>
      </div>
      <BrewArtwork
        variant={copy.variant}
        color={prediction ? beerColor(prediction.srm) : undefined}
      />
      <span className="hero-edition" aria-hidden="true">
        THE HOME BREWER’S STUDIO / BREWMASTER
      </span>
    </section>
  );
}
