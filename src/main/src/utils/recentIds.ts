// A bounded, insertion-ordered set of ids. claim() answers whether the caller
// is the first to see this one; the oldest ids fall out past the limit, so a
// long-running process cannot grow it without bound.
export class RecentIds {
  private ids = new Set<string>()
  private limit: number

  constructor(limit: number) {
    this.limit = limit
  }

  claim(id: string): boolean {
    if (this.ids.has(id)) return false
    this.ids.add(id)
    if (this.ids.size > this.limit) {
      const oldest = this.ids.values().next()
      if (!oldest.done) this.ids.delete(oldest.value)
    }
    return true
  }
}
