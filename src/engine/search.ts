/** Compare displayed names consistently, ignoring case and accents. */
const names = new Intl.Collator("en", { sensitivity: "base", numeric: true });
export function alphabetical<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => names.compare(nameOf(a), nameOf(b)));
}

export function normalizeSearch(text: string): string {
  return text
    .replace(/[®™℠]/g, "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Exact and partial names outrank supporting metadata; ties are alphabetical. */
export function searchByName<T>(
  items: readonly T[],
  query: string,
  nameOf: (item: T) => string,
  textOf: (item: T) => string,
  identifiersOf: (item: T) => readonly string[] = () => [],
): T[] {
  const q = normalizeSearch(query);
  if (!q) return alphabetical(items, nameOf);
  const words = q.split(" ");
  return items
    .map((item, index) => {
      const name = normalizeSearch(nameOf(item));
      const identifiers = identifiersOf(item)
        .filter(Boolean)
        .map(normalizeSearch);
      const text = normalizeSearch(
        name + " " + identifiers.join(" ") + " " + textOf(item),
      );
      const nameWords = name.split(" ");
      const rank =
        name === q || identifiers.includes(q)
          ? 0
          : name.startsWith(q) || identifiers.some((id) => id.startsWith(q))
            ? 1
            : ` ${name} `.includes(` ${q} `)
              ? 2
              : words.every((word) =>
                    nameWords.some((part) => part.startsWith(word)),
                  )
                ? 3
                : name.includes(q)
                  ? 4
                  : 5;
      return {
        item,
        index,
        rank,
        matches: words.every((word) => text.includes(word)),
      };
    })
    .filter((row) => row.matches)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        names.compare(nameOf(a.item), nameOf(b.item)) ||
        a.index - b.index,
    )
    .map((row) => row.item);
}
