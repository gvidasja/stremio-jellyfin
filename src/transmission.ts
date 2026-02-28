export const transmissionUrl = process.env.TRANSMISSION_URL
const user = process.env.TRANSMISSION_USER
const password = process.env.TRANSMISSION_PASSWORD

let sessionId: string | undefined

async function rpc(method: string, args: any) {
  if (!transmissionUrl) return null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (user && password) {
    headers['Authorization'] = 'Basic ' + Buffer.from(user + ':' + password).toString('base64')
  }

  if (sessionId) {
    headers['X-Transmission-Session-Id'] = sessionId
  }

  let result = await fetch(`${transmissionUrl}/transmission/rpc`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ method, arguments: args }),
  })

  if (result.status === 409) {
    sessionId = result.headers.get('x-transmission-session-id') || undefined
    if (sessionId) {
      headers['X-Transmission-Session-Id'] = sessionId
      result = await fetch(`${transmissionUrl}/transmission/rpc`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ method, arguments: args }),
      })
    }
  }

  if (!result.ok) {
    console.error('Transmission RPC error', result.status, await result.text())
    return null
  }

  const json = await result.json()
  return json.arguments
}

export type TorrentInfo = {
  hashString: string
  percentDone: number
  name: string
  status: number
}

export async function getTorrents(): Promise<TorrentInfo[]> {
  const res = await rpc('torrent-get', {
    fields: ['hashString', 'percentDone', 'name', 'status'],
  })
  return (res && res.torrents) || []
}

export async function addTorrent(url: string) {
  return await rpc('torrent-add', { filename: url })
}
