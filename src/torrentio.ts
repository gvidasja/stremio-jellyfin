export type TorrentioStream = {
  name?: string
  title: string
  url?: string
  infoHash: string
  fileIdx?: number
}

export class Torrentio {
  constructor(private settings: string) {}

  async getStreams(type: string, imdbId: string): Promise<TorrentioStream[]> {
    try {
      const url = `https://torrentio.strem.fun/${this.settings}/stream/${type}/${imdbId}.json`
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
