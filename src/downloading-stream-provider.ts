import { Stream, StreamsProvider } from './streams-provider.ts'

export class DownloadingStreamProvider implements StreamsProvider {
  constructor(private streamsProvider: StreamsProvider) {}

  async getStreams(type: string, imdbId: string): Promise<Stream[]> {
    console.log('request for streams: ' + type + ' ' + imdbId)

    const torrentStreams = await this.streamsProvider.getStreams(type, imdbId)
    if (torrentStreams.length === 0) {
      return []
    }

    console.log('received ' + torrentStreams.length + ' streams')

    return torrentStreams.map(stream => this.getDownloadStream(stream, type, imdbId))
  }

  private getDownloadStream(stream: Stream, type: string, imdbId: string): Stream {
    const torrentUrl = stream.url || `magnet:?xt=urn:btih:${stream.infoHash}`
    const host = process.env.ADDON_HOST || 'http://127.0.0.1'
    const port = (process.env.SERVER_PORT && parseInt(process.env.SERVER_PORT)) || 60421
    const fileIdxQuery = stream.fileIdx !== undefined ? `&fileIdx=${stream.fileIdx}` : ''
    const url = `${host}:${port}/download/${stream.infoHash}?url=${encodeURIComponent(torrentUrl)}&type=${encodeURIComponent(type)}&imdbId=${encodeURIComponent(imdbId)}${fileIdxQuery}`

    return {
      name: stream.name || 'Torrentio',
      title: `[DOWNLOAD] ${stream.title || stream.name}`,
      url,
      infoHash: stream.infoHash,
    }
  }
}
