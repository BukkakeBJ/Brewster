/** Original BrewMaster mark: layered, pointed hop bracts beside an awned barley ear. */
export default function BrandMark({
  className = "",
  size = 48,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g transform="rotate(12 28 42)">
          <g fill="currentColor" stroke="none">
            <path d="M27 14C18 17 19 25 27 33C35 25 36 17 27 14Z" opacity="1" />
            <path d="M16 22C8 25 7 33 12 41C18 37 24 32 22 26Z" opacity=".7" />
            <path
              d="M38 22C46 25 47 33 42 41C36 37 30 32 32 26Z"
              opacity=".7"
            />
            <path d="M27 32C19 36 20 44 27 53C34 44 35 36 27 32Z" opacity="1" />
            <path d="M11 41C8 49 13 57 22 62C25 53 22 46 11 41Z" opacity=".8" />
            <path
              d="M43 41C46 49 41 57 32 62C29 53 32 46 43 41Z"
              opacity=".8"
            />
            <path d="M27 54C20 57 21 64 27 70C33 64 34 57 27 54Z" opacity="1" />
          </g>
          <path d="M27 15C30 9 37 11 38 3M24 65C26 71 32 73 36 75" />
        </g>
        <path d="M32 75C45 63 58 43 59 14M59 14L63 3" />
        <path
          d="M59 21C51 21 47 16 49 10C56 11 60 15 59 21ZM58 30C65 29 70 24 68 18C61 18 57 23 58 30ZM56 40C48 38 45 33 48 27C55 29 58 33 56 40ZM53 49C61 49 67 43 66 36C58 36 53 41 53 49ZM48 59C41 56 39 51 42 45C49 47 51 52 48 59Z"
          fill="currentColor"
          fillOpacity=".18"
        />
        <path d="M49 11L46 4M68 19L74 11M48 28L44 20M65 37L74 29M42 46L38 38M32 75L40 76" />
      </g>
    </svg>
  );
}
