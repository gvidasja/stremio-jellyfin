import { addonBuilder, ContentType } from 'stremio-addon-sdk'
import { Jellyfin, ListItem, server } from './jellyfin.js'
import { manifest } from './manifest.js'

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

  if (!itemId) {
    console.log(`Cant find streams for: ${imdbId}`)
    return { streams: [] }
  }

  return {
    streams: [await jellyfin.getStream(itemId)],
  }
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
