import { DB } from './db.js'
import { FullItem, Jellyfin } from './jellyfin.js'
import { TorrentioStream } from './torrentio.js'
import { TorrentInfo } from './transmission.js'

export async function resolveSubDir(type: string, imdbId: string): Promise<string> {
  if (type === 'movie') {
    return 'movies'
  }

  if (type !== 'series') {
    return ''
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

  return `tv/${showName}`
}

export function matchJellyfinStream(
  stream: TorrentioStream,
  torrentMap: Map<string, TorrentInfo>,
  jfItem: FullItem | null,
  itemId: string | undefined,
  jellyfin: Jellyfin,
  db: DB,
): TorrentioStream | undefined {
  if (!jfItem?.MediaSources || !itemId) return undefined

  const infoHash = stream.infoHash?.toLowerCase()
  const torrent = infoHash ? torrentMap.get(infoHash) : undefined
  const cachedTorrentName = infoHash ? db.getTorrentName(infoHash) : undefined
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
      url: jellyfin.getStreamUrl(itemId, matchingSource.Id),
      infoHash: stream.infoHash,
    }
  }

  return undefined
}

export function getDownloadStream(
  stream: TorrentioStream,
  type: string,
  imdbId: string,
): TorrentioStream {
  const torrentUrl = stream.url || `magnet:?xt=urn:btih:${stream.infoHash}`
  const host = process.env.ADDON_HOST || 'http://127.0.0.1'
  const port = (process.env.SERVER_PORT && parseInt(process.env.SERVER_PORT)) || 60421
  const fileIdxQuery = stream.fileIdx !== undefined ? `&fileIdx=${stream.fileIdx}` : ''
  const url = `${host}:${port}/download/${stream.infoHash}?url=${encodeURIComponent(torrentUrl)}&type=${encodeURIComponent(type)}&imdbId=${encodeURIComponent(imdbId)}${fileIdxQuery}`

  return {
    name: stream.name || 'Torrentio',
    title: `[DOWNLOAD] ${stream.title}`,
    url,
    infoHash: stream.infoHash,
  }
}
