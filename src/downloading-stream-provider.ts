import { DB } from './db.ts'
import { FullItem, Jellyfin } from './jellyfin.ts'
import { Stream, StreamsProvider } from './streams-provider.ts'
import { TorrentInfo, Transmission } from './transmission.ts'

export class DownloadingStreamProvider implements StreamsProvider {
  constructor(
    private jellyfin: Jellyfin,
    private streamsProvider: StreamsProvider,
    private db: DB,
    private transmission: Transmission,
  ) {}

  async getStreams(type: string, imdbId: string): Promise<Stream[]> {
    console.log('request for streams: ' + type + ' ' + imdbId)

    const torrentStreams = await this.streamsProvider.getStreams(type, imdbId)
    if (torrentStreams.length === 0) {
      return []
    }

    console.log('received ' + torrentStreams.length + ' streams')

    const torrents = await this.transmission.getTorrents()
    const torrentMap = new Map<string, TorrentInfo>(
      torrents.map(t => {
        this.db.upsertTorrent(t.hashString, t.name)
        return [t.hashString.toLowerCase(), t]
      }),
    )

    const { jfItem, itemId } = await this.getJellyfinData(imdbId)

    return [
      ...(itemId ? await this.jellyfin.getStreams(itemId) : []),
      ...torrentStreams.flatMap(stream => {
        const matchingStream = this.matchJellyfinStream(stream, torrentMap, jfItem, itemId)
        if (matchingStream) return [stream, matchingStream]
        return [stream, this.getDownloadStream(stream, type, imdbId)]
      }),
    ]
  }

  private async getJellyfinData(
    imdbId: string,
  ): Promise<{ jfItem: FullItem | null; itemId: string | undefined }> {
    const itemId = imdbId.includes(':')
      ? await this.getEpisodeItemId(imdbId)
      : await this.jellyfin.getItemIdByImdbId(imdbId)

    let jfItem: FullItem | null = null
    if (itemId) {
      try {
        jfItem = await this.jellyfin.getFullItem(itemId)
      } catch (e) {
        console.log('failed to fetch jellyfin full item or stream', e)
      }
    }

    return { jfItem, itemId }
  }

  private async getEpisodeItemId(imdbId: string): Promise<string | undefined> {
    const resolvedId = imdbId.split(':')
    const seriesId = resolvedId[0]
    const seasonIndex = parseInt(resolvedId[1])
    const episodeIndex = parseInt(resolvedId[2])

    const seriesItemId = await this.jellyfin.getItemIdByImdbId(seriesId)

    if (!seriesItemId) {
      return
    }

    return await this.jellyfin.getEpisodeItemId(seriesItemId, seasonIndex, episodeIndex)
  }

  private matchJellyfinStream(
    stream: Stream,
    torrentMap: Map<string, TorrentInfo>,
    jfItem: FullItem | null,
    itemId: string | undefined,
  ): Stream | undefined {
    if (!jfItem?.MediaSources || !itemId) return undefined

    const infoHash = stream.infoHash?.toLowerCase()
    const torrent = infoHash ? torrentMap.get(infoHash) : undefined
    const cachedTorrentName = infoHash ? this.db.getTorrentName(infoHash) : undefined
    const titleLines = stream.title?.split('\n') ?? []

    const matchingSource = jfItem.MediaSources.find(source => {
      if (!source.Path) return false

      // Exact match by name tracked from transmission
      const matchName = torrent?.name || cachedTorrentName
      if (matchName && source.Path.includes(matchName)) return true

      // Cleanup string similarity or standard cleanup
      if (titleLines.length > 2) {
        const title = titleLines[titleLines.length - 1]
        const sanitizedSource = source.Path.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        const sanitizedTitle = title
          .replace(/\.(mkv|mp4|avi)$/i, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase()
        if (sanitizedSource.includes(sanitizedTitle)) return true
      }
      return false
    })

    if (matchingSource) {
      return {
        name: stream.name || 'Torrentio',
        title: `[JELLYFIN] ${stream.title}`,
        url: this.jellyfin.getStreamUrl(itemId, matchingSource.Id),
        infoHash: stream.infoHash,
      }
    }

    return undefined
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
