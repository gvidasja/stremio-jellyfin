export type TorrentInfo = {
  hashString: string
  percentDone: number
  name: string
  status: number
}

export class Transmission {
  private sessionId: string | undefined

  constructor(
    private transmissionUrl: string,
    private user?: string,
    private password?: string,
    private downloadDirBase: string = '/srv/transmission/downloads',
  ) {}

  async getTorrents(): Promise<TorrentInfo[]> {
    const res = await this.rpc('torrent-get', {
      fields: ['hashString', 'percentDone', 'name', 'status'],
    })

    return (res && res.torrents) || []
  }

  async addTorrent(url: string, subDir?: string) {
    const args: any = { filename: url, bandwidthPriority: 1 }

    args['sequentialDownload'] = false
    if (subDir) {
      args['download-dir'] = `${this.downloadDirBase}/${subDir}`.replace(/\/+/g, '/')
    } else {
      args['download-dir'] = this.downloadDirBase
    }

    return await this.rpc('torrent-add', args)
  }

  private async rpc(method: string, args: any) {
    if (!this.transmissionUrl) return null

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.user && this.password) {
      headers['Authorization'] =
        'Basic ' + Buffer.from(this.user + ':' + this.password).toString('base64')
    }

    const makeRequest = () =>
      fetch(`${this.transmissionUrl}/transmission/rpc`, {
        method: 'POST',
        headers: {
          ...headers,
          ...(this.sessionId ? { 'X-Transmission-Session-Id': this.sessionId } : {}),
        },
        body: JSON.stringify({ method, arguments: args }),
      })

    let result = await makeRequest()

    if (result.status === 409) {
      this.sessionId = result.headers.get('x-transmission-session-id') || undefined
      if (this.sessionId) {
        result = await makeRequest()
      }
    }

    if (!result.ok) {
      console.error('Transmission RPC error', result.status, await result.text())
      return null
    }

    const json = await result.json()
    return json.arguments
  }
}
