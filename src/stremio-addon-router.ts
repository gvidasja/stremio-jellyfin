import { addonBuilder, ContentType, getRouter } from 'stremio-addon-sdk'
import { manifest } from './manifest.ts'
import { StreamsProvider } from './streams-provider.ts'

export class StremioAddonRouter {
  constructor(private streamsProvider: StreamsProvider) {}

  async getStreams({ type, id: imdbId }: { type: ContentType; id: string }) {
    return {
      streams: await this.streamsProvider.getStreams(type, imdbId),
    }
  }

  public routes() {
    const builder = new addonBuilder(manifest)
    builder.defineStreamHandler(args => this.getStreams(args))
    return getRouter(builder.getInterface())
  }
}
