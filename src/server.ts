import express from 'express'
import { DownloadRouter } from './download-router.ts'
import { DownloadingStreamProvider } from './downloading-stream-provider.ts'
import { FallbackTorrentProvider } from './fallback-provider.ts'
import { StremioAddonRouter } from './stremio-addon-router.ts'
import { StremioStreamProvider } from './stremio-stream-provider.ts'
import { Qbittorrent } from './qbittorrent.ts'

// qBittorrent Config
const qbittorrentUrl = process.env.QBITTORRENT_URL

if (!qbittorrentUrl) {
  throw new Error('QBITTORRENT_URL is not set')
}

// Torrentio Config
const torrentioSettings =
  process.env.TORRENTIO_SETTINGS ||
  'providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex,mejortorrent,wolfmax4k,besttorrents|qualityfilter=threed,720p,480p,scr,cam,unknown|limit=2'

// Instantiate dependencies
const qbittorrent = new Qbittorrent(qbittorrentUrl)

// Providers
const streamsProvider = new DownloadingStreamProvider(
  new FallbackTorrentProvider([
    new StremioStreamProvider(`https://torrentio.strem.fun/${torrentioSettings}`),
    new StremioStreamProvider(`https://cometfortheweebs.midnightignite.me`),
  ]),
)

// Instantiate services
const stremioAddonRouter = new StremioAddonRouter(streamsProvider)
const downloadRouter = new DownloadRouter(qbittorrent)

// Build Stremio Addon
const app = express()

app.use((req, _, next) => {
  console.log(`[${req.method}] ${req.url}`)
  next()
})

app.use(downloadRouter.router())
app.use(stremioAddonRouter.routes())

const port = (process.env.SERVER_PORT && parseInt(process.env.SERVER_PORT)) || 60421

app.listen(port, () => {
  console.log(`addon running on http://localhost:${port}`)
})
