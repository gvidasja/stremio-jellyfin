import { Stream, StreamsProvider } from './streams-provider.ts'

export class StremioStreamProvider implements StreamsProvider {
  constructor(private baseUrl: string) {}

  async getStreams(type: string, imdbId: string): Promise<Stream[]> {
    const url = `${this.baseUrl}/stream/${type}/${imdbId}.json`

    try {
      console.log(`calling: ${url}`)

      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })

      if (res.ok) {
        const data = await res.json()
        return data.streams || []
      }
    } catch (e) {
      console.log(`failed to fetch from ${url}`, e)
    }
    return []
  }
}
