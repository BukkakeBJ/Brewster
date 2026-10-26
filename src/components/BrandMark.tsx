/** Botanical hop-and-barley illustration based on the brewer's photo reference. */
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
      viewBox="225 20 1200 950"
      fill="none"
      aria-hidden="true"
    >
      <image
        href="/brand/hop-barley-botanical.png"
        x="0"
        y="0"
        width="1536"
        height="1024"
      />
    </svg>
  );
}
