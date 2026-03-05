export const TORRENTIO_SETTINGS =
  process.env.TORRENTIO_SETTINGS ||
  'providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex,mejortorrent,wolfmax4k,besttorrents|qualityfilter=threed,720p,480p,scr,cam,unknown|limit=2'

export type TorrentioStream = {
  name?: string
  title: string
  url?: string
  infoHash: string
  fileIdx?: number
}

export class Torrentio {
  async getStreams(type: string, imdbId: string): Promise<TorrentioStream[]> {
    try {
      const url = `https://torrentio.strem.fun/${TORRENTIO_SETTINGS}/stream/${type}/${imdbId}.json`
      console.log(url)
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        return data.streams || []
      }
    } catch (e) {
      console.log('Failed to fetch from torrentio', e)
    }
    return []
  }
}

export const torrentio = new Torrentio()
