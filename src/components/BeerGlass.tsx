import { beerColor } from "../engine/calculations";
import { colorName, glassFor, type Glass } from "../engine/glassware";

/**
 * Canva-illustrated glassware with the beer tinted to the predicted color.
 * The art's beer is neutral grey shading; a multiply layer masked to the beer adds the color.
 */
export default function BeerGlass({
  srm,
  styleId = "",
  glass = glassFor(styleId),
  size = "md",
  className = "",
}: {
  srm: number;
  styleId?: string;
  glass?: Glass;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const mask = `url(/beers/${glass}-beer.webp)`;
  return (
    <span
      className={`beer-glass ${size} ${className}`}
      role="img"
      aria-label={`${colorName(srm)} beer, about ${srm.toFixed(0)} SRM`}
    >
      <img
        src={`/beers/${glass}.webp`}
        alt=""
        draggable={false}
        loading="lazy"
      />
      <i
        className="beer-tint"
        style={{
          background: beerColor(srm),
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      />
    </span>
  );
}
