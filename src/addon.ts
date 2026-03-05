import { addonBuilder, ContentType } from 'stremio-addon-sdk'
import { FullItem, Jellyfin, ListItem, server } from './jellyfin.js'
import { manifest } from './manifest.js'
import { Torrentio, TorrentioStream } from './torrentio.js'
import { getTorrents, TorrentInfo } from './transmission.js'

const torrentio = new Torrentio()

export const jellyfin = new Jellyfin()
await jellyfin.authenticate()

let builder = new addonBuilder(manifest)

const JELLYFIN_ITEM_TYPE_MAP: Record<string, ContentType> = {
  movie: 'movie',
  series: 'series',
}

function itemToMeta(item: ListItem) {
  return {
    id: item.ProviderIds.Imdb,
    type: JELLYFIN_ITEM_TYPE_MAP[item.Type.toLowerCase()],
    name: item.Name,
    poster: `${server}/Items/${item.Id}/Images/Primary`,
  }
}

builder.defineCatalogHandler(async ({ type, id, extra }) => {
  console.log('request for catalogs: ' + type + ' ' + id)

  const items = await jellyfin.searchItems(extra.skip || 0, type === 'movie', extra.search)

  return {
    metas: items.map(itemToMeta),
  }
})

builder.defineStreamHandler(async ({ type, id: imdbId }) => {
  console.log('request for streams: ' + type + ' ' + imdbId)

  const torrentioStreams = await torrentio.getStreams(type, imdbId)
  if (torrentioStreams.length === 0) {
    return { streams: [] }
  }

  console.log(torrentioStreams)

  const torrents = await getTorrents()
  const torrentMap = new Map<string, TorrentInfo>(
    (torrents || []).map(t => [t.hashString.toLowerCase(), t]),
  )

  const downloadDir = await resolveDownloadDir(type, imdbId)
  const { jfItem, itemId } = await getJellyfinData(imdbId)

  console.log(torrentioStreams)

  return {
    streams: torrentioStreams.flatMap(stream => [
      stream,
      matchJellyfinStream(stream, torrentMap, jfItem, itemId) ||
        getDownloadStream(stream, downloadDir, imdbId),
    ]),
  }
})

export const addonInterface = builder.getInterface()

async function getJellyfinData(
  imdbId: string,
): Promise<{ jfItem: FullItem | null; itemId: string | undefined }> {
  const itemId = imdbId.includes(':')
    ? await getEpisodeItemId(imdbId)
    : await jellyfin.getItemIdByImdbId(imdbId)

  let jfItem: FullItem | null = null
  if (itemId) {
    try {
      const dashedItemId = itemId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/g, '$1-$2-$3-$4-$5')
      jfItem = await jellyfin.getFullItem(dashedItemId)
    } catch (e) {
      console.log('Failed to fetch jellyfin full item or stream', e)
    }
  }

  return { jfItem, itemId }
}

async function resolveDownloadDir(type: string, imdbId: string): Promise<string> {
  if (type === 'movie') {
    return '/srv/transmission/downloads/movies'
  }

  if (type !== 'series') {
    return '/srv/transmission/downloads'
  }

  const seriesId = imdbId.split(':')[0]
  let showName = 'unknown-show'
  try {
    const res = await fetch(`https://v3-cinemeta.strem.io/meta/series/${seriesId}.json`)
    if (res.ok) {
      const data = await res.json()
      if (data?.meta?.name) {
        showName = data.meta.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
      }
    }
  } catch (e) {}

  return `/srv/transmission/downloads/tv/${showName}`
}

function matchJellyfinStream(
  stream: TorrentioStream,
  torrentMap: Map<string, TorrentInfo>,
  jfItem: FullItem | null,
  itemId: string | undefined,
): TorrentioStream | undefined {
  if (!jfItem?.MediaSources || !itemId) return undefined

  const infoHash = stream.infoHash?.toLowerCase()
  const torrent = infoHash ? torrentMap.get(infoHash) : undefined
  const titleLines = stream.title?.split('\n') ?? []

  const matchingSource = jfItem.MediaSources.find(source => {
    if (!source.Path) return false
    if (torrent && source.Path.includes(torrent.name)) return true
    if (titleLines.length > 2 && source.Path.includes(titleLines[titleLines.length - 1]))
      return true
    return false
  })

  if (matchingSource) {
    return {
      name: stream.name || 'Torrentio',
      title: `[JELLYFIN] ${stream.title}`,
      url: jellyfin.getStreamUrl(itemId, matchingSource.Id),
      infoHash: stream.infoHash,
    }
  }

  return undefined
}

function getDownloadStream(
  stream: TorrentioStream,
  downloadDir: string,
  imdbId: string,
): TorrentioStream {
  const torrentUrl = stream.url || `magnet:?xt=urn:btih:${stream.infoHash}`
  const host = process.env.ADDON_HOST || 'http://127.0.0.1'
  const port = (process.env.SERVER_PORT && parseInt(process.env.SERVER_PORT)) || 60421
  const fileIdxQuery = stream.fileIdx !== undefined ? `&fileIdx=${stream.fileIdx}` : ''
  const url = `${host}:${port}/download/${stream.infoHash}?url=${encodeURIComponent(torrentUrl)}&downloadDir=${encodeURIComponent(downloadDir)}&imdbId=${encodeURIComponent(imdbId)}${fileIdxQuery}`

  return {
    name: stream.name || 'Torrentio',
    title: `[DOWNLOAD] ${stream.title}`,
    url,
    infoHash: stream.infoHash,
  }
}

export async function getEpisodeItemId(imdbId: string): Promise<string | undefined> {
  const resolvedId = imdbId.split(':')
  const seriesId = resolvedId[0]
  const seasonIndex = parseInt(resolvedId[1])
  const episodeIndex = parseInt(resolvedId[2])

  const seriesItemId = await jellyfin.getItemIdByImdbId(seriesId)

  if (!seriesItemId) {
    return
  }

  return await jellyfin.getEpisodeItemId(seriesItemId, seasonIndex, episodeIndex)
}
