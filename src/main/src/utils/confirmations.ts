// A transaction in the tip block has one confirmation. Height 0 is the mempool,
// and a tip we have not validated headers up to yet cannot count any.
export function confirmationsAt(height: number, tipHeight: number): number {
  if (height <= 0 || tipHeight < height) return 0
  return tipHeight - height + 1
}
