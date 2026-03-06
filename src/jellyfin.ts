import os from 'os'
import { Stream, StreamsProvider } from './streams-provider'

const device = os.hostname()

type JellyfinAuth = {
  AccessToken: string
  User: {
    Id: string
  }
}

type JellyfinItems<T> = {
  Items: T[]
}

export type ListItem = {
  Id: string
  Name: string
  ProviderIds: { Imdb: string }
  Type: string
  IndexNumber?: number
}

export type FullItem = {
  Id: string
  Name: string
  ProviderIds: { Imdb: string }
  Type: string
  MediaSources: {
    Id: string
    Path: string
    MediaStreams: {
      DisplayTitle: string
    }[]
  }[]
}

export class Jellyfin implements StreamsProvider {
  private auth?: JellyfinAuth

  constructor(
    public server: string,
    private user: string,
    private password: string,
  ) {}

  async authenticate() {
    this.auth = await this.getAuth()
  }

  async getFullItem(itemId: string) {
    const params = new URLSearchParams({
      fields: 'MediaSources',
    })

    return this.get<FullItem>(`/Items/${itemId}`, params)
  }

  async getItemIdByImdbId(imdbId: string): Promise<string | undefined> {
    const params = new URLSearchParams({
      hasImdbId: 'true',
      recursive: 'true',
      fields: 'ProviderIds',
    })

    const searchResults = await this.get<JellyfinItems<ListItem>>('/Items', params)

    return searchResults.Items.find(it => it.ProviderIds.Imdb === imdbId)?.Id
  }

  async getEpisodeItemId(itemId: string, seasonIndex: number, episodeIndex: number) {
    const params = new URLSearchParams({
      season: seasonIndex.toString(),
      userId: await this.getUserId(),
    })

    const episodes = await this.get<JellyfinItems<ListItem>>(`/Shows/${itemId}/Episodes`, params)

    return episodes.Items.find(it => it.IndexNumber === episodeIndex)?.Id
  }

  async getStreams(itemId: string): Promise<Stream[]> {
    if (!this.auth) {
      this.auth = await this.getAuth()
    }

    const item = await this.getFullItem(itemId)

    return item.MediaSources.map(ms => ({
      url: this.getStreamUrl(itemId, item.MediaSources[0].Id),
      name: 'Jellyfin',
      title: ms.MediaStreams[0].DisplayTitle,
    }))
  }

  getStreamUrl(itemId: string, mediaSourceId: string): string {
    if (!this.auth) {
      throw new Error('Jellyfin is not authenticated')
    }

    const params = new URLSearchParams({
      static: 'true',
      api_key: this.auth.AccessToken,
      mediaSourceId,
    })

    return `${this.server}/videos/${itemId}/stream.mkv?${params}`
  }

  async refreshLibrary() {
    if (!this.auth) {
      this.auth = await this.getAuth()
    }

    console.log('triggering Jellyfin library refresh...')

    return fetch(`${this.server}/Library/Refresh`, {
      method: 'POST',
      headers: {
        'X-Emby-Authorization': await this.getAuthHeader(),
      },
    })
  }

  private async get<T>(path: string, params?: URLSearchParams): Promise<T> {
    return fetch(`${this.server}${path}?${params}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': await this.getAuthHeader(),
      },
    }).then(r => r.json())
  }

  private async getAuthHeader(): Promise<string> {
    if (!this.auth) {
      this.auth = await this.getAuth()
    }

    return `MediaBrowser Client="Jellyfin Stremio Addon", Device="${device}", DeviceId="${device}", Version="1.0.0.0", Token="${this.auth.AccessToken}"`
  }

  private async getUserId(): Promise<string> {
    if (!this.auth) {
      this.auth = await this.getAuth()
    }

    return this.auth.User.Id
  }

  private async getAuth(): Promise<JellyfinAuth> {
    console.log(`connecting to Jellyfin server: ${this.server} with username: ${this.user}`)

    return await fetch(`${this.server}/Users/authenticatebyname`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': `MediaBrowser Client="Jellyfin Stremio Addon", Device="${device}", DeviceId="${device}", Version="1.0.0.0""`,
      },
      body: JSON.stringify({ Username: this.user, Pw: this.password }),
    }).then(async it => {
      const response = await it.json()

      if (it.status !== 200) {
        console.log(`failed to authenticate: ${JSON.stringify(response)}`)
        process.exit(1)
      }

      console.log(`successfully connected to Jellyfin server: ${this.server}. Happy streaming.`)
      return response
    })
  }
}
