import { Stream, StreamsProvider } from './streams-provider.ts'

export class FallbackTorrentProvider implements StreamsProvider {
  constructor(private providers: StreamsProvider[]) {}

  async getStreams(type: string, imdbId: string): Promise<Stream[]> {
    for (const provider of this.providers) {
      const streams = await provider.getStreams(type, imdbId)
      if (streams && streams.length > 0) {
        return streams
      }
    }
    return []
  }
}
