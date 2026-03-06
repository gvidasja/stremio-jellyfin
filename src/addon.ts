import { addonBuilder, ContentType, getRouter } from 'stremio-addon-sdk'
import { DB } from './db.js'
import { FullItem, Jellyfin, ListItem } from './jellyfin.js'
import { manifest } from './manifest.js'
import { getDownloadStream, matchJellyfinStream } from './stream-helpers.js'
import { Torrentio } from './torrentio.js'
import { TorrentInfo, Transmission } from './transmission.js'

const JELLYFIN_ITEM_TYPE_MAP: Record<string, ContentType> = {
  movie: 'movie',
  series: 'series',
}

export class Addon {
  constructor(
    private jellyfin: Jellyfin,
    private torrentio: Torrentio,
    private db: DB,
    private transmission: Transmission,
  ) {}

  private itemToMeta(item: ListItem) {
    return {
      id: item.ProviderIds.Imdb,
      type: JELLYFIN_ITEM_TYPE_MAP[item.Type.toLowerCase()],
      name: item.Name,
      poster: `${this.jellyfin.server}/Items/${item.Id}/Images/Primary`,
    }
  }

  async getCatalog({ type, id, extra }: { type: ContentType; id: string; extra: any }) {
    console.log('request for catalogs: ' + type + ' ' + id)

    const items = await this.jellyfin.searchItems(extra.skip || 0, type === 'movie', extra.search)

    return {
      metas: items.map(item => this.itemToMeta(item)),
    }
  }

  async getStream({ type, id: imdbId }: { type: ContentType; id: string }) {
    console.log('request for streams: ' + type + ' ' + imdbId)

    const torrentioStreams = await this.torrentio.getStreams(type, imdbId)
    if (torrentioStreams.length === 0) {
      return { streams: [] }
    }

    console.log(torrentioStreams)

    const torrents = await this.transmission.getTorrents()
    const torrentMap = new Map<string, TorrentInfo>(
      (torrents || []).map(t => {
        this.db.upsertTorrent(t.hashString, t.name)
        return [t.hashString.toLowerCase(), t]
      }),
    )

    const { jfItem, itemId } = await this.getJellyfinData(imdbId)

    console.log(torrentioStreams)

    return {
      streams: torrentioStreams.flatMap(stream => {
        const matchingStream = matchJellyfinStream(
          stream,
          torrentMap,
          jfItem,
          itemId,
          this.jellyfin,
          this.db,
        )
        if (matchingStream) return [stream, matchingStream]
        return [stream, getDownloadStream(stream, type, imdbId)]
      }),
    }
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
        console.log('Failed to fetch jellyfin full item or stream', e)
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

  public routes() {
    const builder = new addonBuilder(manifest)
    builder.defineCatalogHandler(args => this.getCatalog(args))
    builder.defineStreamHandler(args => this.getStream(args))
    return getRouter(builder.getInterface())
  }
}
