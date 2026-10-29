/**
 * When the camera saw more pointings than the person spoke about, keeps the longest ones in their
 * original order. Short extra pointings are usually the hand passing over a product on the way in or out.
 */
export function keepLongest<T extends { duration: number }>(items: T[], count: number): T[] {
  if (items.length <= count) return items;

  const keep = new Set(
    items
      .map((item, index) => ({ index, duration: item.duration }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, count)
      .map((item) => item.index),
  );
  return items.filter((_, index) => keep.has(index));
}