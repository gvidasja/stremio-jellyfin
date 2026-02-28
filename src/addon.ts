import { addonBuilder, ContentType } from 'stremio-addon-sdk'
import { Jellyfin, ListItem, server } from './jellyfin.js'
import { manifest } from './manifest.js'
import { getTorrents } from './transmission.js'

const jellyfin = new Jellyfin()
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

  const itemId = imdbId.includes(':')
    ? await getEpisodeItemId(imdbId)
    : await jellyfin.getItemIdByImdbId(imdbId)

  let jfItem: any = null
  let jfStream: any = null
  if (itemId) {
    try {
      const dashedItemId = itemId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/g, '$1-$2-$3-$4-$5')
      jfItem = await jellyfin.getFullItem(dashedItemId)
      jfStream = await jellyfin.getStream(itemId)
    } catch (e) {
      console.log('Failed to fetch jellyfin full item or stream', e)
    }
  }

  const torrents = await getTorrents()
  const torrentMap = new Map((torrents || []).map(t => [t.hashString.toLowerCase(), t]))

  let torrentioStreams: any[] = []
  try {
    const res = await fetch(`https://torrentio.strem.fun/stream/${type}/${imdbId}.json`)
    if (res.ok) {
      const data = await res.json()
      torrentioStreams = data.streams || []
    }
  } catch (e) {
    console.log('Failed to fetch from torrentio', e)
  }

  const streams = []

  for (const stream of torrentioStreams) {
    const infoHash = stream.infoHash?.toLowerCase()
    const torrent = infoHash ? torrentMap.get(infoHash) : undefined

    let title = stream.title
    if (torrent) {
      const percent = Math.round(torrent.percentDone * 100)
      title = `[${percent}%] ` + title
    }

    let isJellyfinSource = false
    if (jfItem && jfItem.MediaSources) {
      for (const source of jfItem.MediaSources) {
        if (source.Path && torrent && source.Path.includes(torrent.name)) {
          isJellyfinSource = true
          break
        }
        const titleLines = stream.title ? stream.title.split('\n') : []
        if (
          titleLines.length > 2 &&
          source.Path &&
          source.Path.includes(titleLines[titleLines.length - 1])
        ) {
          isJellyfinSource = true
          break
        }
      }
    }

    let url: string
    if (isJellyfinSource && jfStream) {
      url = jfStream.url
    } else {
      const trackers = [
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://tracker.ds.is:6969/announce',
      ]
      const torrentUrl =
        stream.url || `magnet:?xt=urn:btih:${stream.infoHash}&tr=${trackers.join('&tr=')}`
      const port = (process.env.SERVER_PORT && parseInt(process.env.SERVER_PORT)) || 60421
      url = `http://127.0.0.1:${port}/download/${stream.infoHash}?url=${encodeURIComponent(torrentUrl)}`
    }

    streams.push({
      name: stream.name || 'Torrentio',
      title,
      url,
    })
  }

  return { streams }
})

async function getEpisodeItemId(imdbId: string): Promise<string | undefined> {
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

export const addonInterface = builder.getInterface()
