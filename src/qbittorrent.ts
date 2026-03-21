export type TorrentFile = {
  name: string
  size: number
  progress: number
  priority: number
  is_seed: boolean
  piece_range: [number, number]
  availability: number
}

export class Qbittorrent {
  constructor(private qbittorrentUrl: string) {}

  async addTorrent(url: string, infoHash: string) {
    const formData = new FormData()
    formData.append('urls', url)
    formData.append('savepath', `/data/torrents/${infoHash}`)
    formData.append('sequentialDownload', 'true')
    formData.append('firstLastPiecePrio', 'true')

    const result = await fetch(`${this.qbittorrentUrl}/api/v2/torrents/add`, {
      method: 'POST',
      body: formData,
    })

    if (!result.ok) {
      console.error('qBittorrent add error', result.status, await result.text())
    }
  }

  async getFiles(infoHash: string): Promise<TorrentFile[]> {
    const result = await fetch(`${this.qbittorrentUrl}/api/v2/torrents/files?hash=${infoHash}`)
    if (!result.ok) {
      if (result.status === 404) return []
      console.error('qBittorrent getFiles error', result.status, await result.text())
      return []
    }
    
    try {
      const json = await result.json()
      return json as TorrentFile[]
    } catch (e) {
      return []
    }
  }

  async setFilePrio(infoHash: string, fileIds: string, priority: number) {
    if (!fileIds) return

    const formData = new URLSearchParams()
    formData.append('hash', infoHash)
    formData.append('id', fileIds)
    formData.append('priority', priority.toString())

    const result = await fetch(`${this.qbittorrentUrl}/api/v2/torrents/filePrio`, {
      method: 'POST',
      body: formData,
    })

    if (!result.ok) {
      console.error('qBittorrent filePrio error', result.status, await result.text())
    }
  }
}
