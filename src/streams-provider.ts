export type Stream = {
  name?: string
  title: string
  url?: string
  infoHash?: string
  fileIdx?: number
}

export interface StreamsProvider {
  getStreams(type: string, imdbId: string): Promise<Stream[]>
}
