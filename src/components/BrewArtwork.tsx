import { useId } from "react";
import BrandMark from "./BrandMark";
export default function BrewArtwork({
  color = "#d5922a",
  variant = "glass",
}: {
  color?: string;
  variant?: "glass" | "botanical" | "book";
}) {
  const uid = useId().replace(/:/g, "");
  return (
    <div className={`brew-art brew-art-${variant}`} aria-hidden="true">
      <svg viewBox="0 0 340 290" fill="none">
        <defs>
          <pattern
            id={`${uid}-dots`}
            width="9"
            height="9"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r=".8" fill="currentColor" opacity=".18" />
          </pattern>
          <linearGradient
            id={`${uid}-beer`}
            x1="100"
            y1="110"
            x2="230"
            y2="240"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#edbf66" />
            <stop offset=".6" stopColor={color} />
            <stop offset="1" stopColor="#9a4d20" />
          </linearGradient>
        </defs>
        <circle cx="175" cy="145" r="120" fill="#ddc897" opacity=".4" />
        <circle
          cx="175"
          cy="145"
          r="105"
          stroke="#827c4d"
          strokeWidth=".7"
          strokeDasharray="2 5"
        />
        <circle
          cx="175"
          cy="145"
          r="134"
          stroke="#8c8e60"
          strokeWidth=".6"
          opacity=".6"
        />
        <path
          d="M31 176H323M175 4V284"
          stroke="#8c8e60"
          strokeWidth=".6"
          opacity=".25"
        />
        <path
          d="M55 67L81 60L84 77M281 228L304 223L300 207"
          stroke="#8c8e60"
          strokeWidth="1.2"
        />
        <ellipse
          cx="180"
          cy="257"
          rx="79"
          ry="10"
          fill="#203e33"
          opacity=".1"
        />
        {variant === "glass" ? (
          <g transform="rotate(7 180 150)">
            <path
              d="M111 67H238L221 244Q175 266 129 244Z"
              fill="#fcf8e9"
              stroke="#4b6345"
              strokeWidth="2"
            />
            <path
              d="M120 99H229L214 239Q176 256 136 239Z"
              fill={`url(#${uid}-beer)`}
            />
            <path
              d="M122 106C143 98 161 113 177 106C196 98 212 111 227 103"
              stroke="#f5e1a6"
              strokeWidth="3"
              opacity=".7"
            />
            <path
              d="M110 80C98 70 109 56 120 58C123 41 144 39 153 49C165 34 190 39 193 51C208 38 229 46 229 58C246 54 250 76 237 81L235 99C220 106 209 96 199 100C179 107 166 97 154 102C136 109 127 99 113 102Z"
              fill="#fffbed"
              stroke="#4b6345"
              strokeWidth="2"
            />
            <path
              d="M139 123L148 218M211 117L203 228"
              stroke="#fff4cb"
              strokeWidth="4"
              strokeLinecap="round"
              opacity=".5"
            />
            <circle cx="164" cy="201" r="2.5" fill="#fff4cb" opacity=".8" />
            <circle cx="199" cy="138" r="2" fill="#fff4cb" opacity=".6" />
            <circle cx="183" cy="222" r="2" fill="#fff4cb" opacity=".6" />
            <path
              d="M139 64Q145 57 154 61M176 57Q182 51 189 58M209 70L219 68"
              stroke="#ddcfa4"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ) : variant === "book" ? (
          <g transform="rotate(-8 176 150)">
            <path
              d="M101 47H224Q246 47 246 67V238H113Q98 238 98 224V62Z"
              fill="#204b3d"
              stroke="#102c24"
              strokeWidth="2"
            />
            <path
              d="M116 48V236M102 230H246M102 222H246"
              stroke="#d4bf85"
              strokeWidth="1.2"
            />
            <rect
              x="132"
              y="72"
              width="93"
              height="130"
              rx="47"
              stroke="#d4bf85"
              strokeWidth="1.4"
            />
            <text
              x="179"
              y="105"
              textAnchor="middle"
              fill="#f0dcaa"
              fontFamily="Georgia,serif"
              fontSize="12"
            >
              THE BREW
            </text>
            <text
              x="179"
              y="123"
              textAnchor="middle"
              fill="#f0dcaa"
              fontFamily="Georgia,serif"
              fontSize="18"
              fontStyle="italic"
            >
              collection
            </text>
            <circle cx="179" cy="162" r="22" fill="#d6ad61" />
            <path
              d="M171 150V172H181Q191 169 182 161Q190 153 181 150Z"
              stroke="#204b3d"
              strokeWidth="2"
            />
            <path d="M211 238V263L221 255L231 263V238" fill="#c48549" />
          </g>
        ) : (
          <g transform="translate(64 26) scale(2.7)">
            <BrandMark size={80} />
          </g>
        )}
        <g stroke="#66754e" strokeWidth="1.5" strokeLinecap="round">
          <path
            d="M63 238C60 211 74 191 74 160M63 215C49 216 44 204 47 197C59 196 65 205 63 215ZM69 196C79 199 90 191 89 181C77 178 69 186 69 196Z"
            fill="#b9be86"
          />
          <path
            d="M271 140L292 75M286 92C276 93 271 86 274 79C282 79 287 83 286 92ZM282 105C293 106 299 101 300 94C291 91 284 96 282 105ZM278 118C268 116 267 109 270 103C277 104 282 111 278 118Z"
            fill="#d7bc76"
          />
          <path d="M292 75L300 65M275 80L271 70M298 94L308 87M270 104L266 95" />
        </g>
        <circle cx="68" cy="102" r="4" fill="#aa6938" />
        <path
          d="M274 251V263M268 257H280M44 138V148M39 143H49"
          stroke="#aa6938"
          strokeWidth="1.4"
        />
      </svg>
      <span className="art-stamp">
        SMALL BATCH
        <br />
        <b>BIG IDEAS</b>
      </span>
    </div>
  );
}
