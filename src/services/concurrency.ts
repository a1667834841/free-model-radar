export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}
