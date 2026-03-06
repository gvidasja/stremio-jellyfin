import express from 'express'
import { DB } from './db.ts'
import { DownloadRouter } from './download-router.ts'
import { DownloadingStreamProvider } from './downloading-stream-provider.ts'
import { FallbackTorrentProvider } from './fallback-provider.ts'
import { Jellyfin } from './jellyfin.ts'
import { StremioAddonRouter } from './stremio-addon-router.ts'
import { StremioStreamProvider } from './stremio-stream-provider.ts'
import { Transmission } from './transmission.ts'

// Jellyfin Config
const jellyfinServer = process.env.JELLYFIN_SERVER
const jellyfinUser = process.env.JELLYFIN_USER || 'username'
const jellyfinPassword = process.env.JELLYFIN_PASSWORD || 'password'

// Torrentio Config
const torrentioSettings =
  process.env.TORRENTIO_SETTINGS ||
  'providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex,mejortorrent,wolfmax4k,besttorrents|qualityfilter=threed,720p,480p,scr,cam,unknown|limit=2'

// const cometSettings = btoa(
//   JSON.stringify({
//     maxResultsPerResolution: 10,
//     maxSize: 0,
//     cachedOnly: true,
//     sortCachedUncachedTogether: false,
//     removeTrash: true,
//     resultFormat: ['all'],
//     debridServices: [],
//     enableTorrent: true,
//     deduplicateStreams: false,
//     scrapeDebridAccountTorrents: false,
//     debridStreamProxyPassword: '',
//     languages: {
//       required: [],
//       allowed: [],
//       exclude: [],
//       preferred: [],
//     },
//     resolutions: {
//       r720p: false,
//       r576p: false,
//       r480p: false,
//       r360p: false,
//       r240p: false,
//       unknown: false,
//     },
//     options: {
//       remove_ranks_under: -10000000000,
//       allow_english_in_languages: false,
//       remove_unknown_languages: false,
//     },
//   }),
// )

// Transmission Config
const transmissionUrl = process.env.TRANSMISSION_URL
const transmissionUser = process.env.TRANSMISSION_USER
const transmissionPassword = process.env.TRANSMISSION_PASSWORD
const transmissionDownloadDir =
  process.env.TRANSMISSION_DOWNLOAD_DIR || '/srv/transmission/downloads'

// DB Configuration
const dbPath = process.env.DB_PATH || 'cache.sqlite'

if (
  !jellyfinServer ||
  !jellyfinUser ||
  !jellyfinPassword ||
  !transmissionUrl ||
  !transmissionUser ||
  !transmissionPassword ||
  !transmissionDownloadDir
) {
  throw new Error('Missing required environment variables')
}

// Instantiate dependencies
const db = new DB(dbPath)
const jellyfin = new Jellyfin(jellyfinServer, jellyfinUser, jellyfinPassword)
const transmission = new Transmission(
  transmissionUrl,
  transmissionUser,
  transmissionPassword,
  transmissionDownloadDir,
)

// Providers
const streamsProvider = new DownloadingStreamProvider(
  jellyfin,
  new FallbackTorrentProvider([
    new StremioStreamProvider(`https://torrentio.strem.fun/${torrentioSettings}`),
    new StremioStreamProvider(`https://cometfortheweebs.midnightignite.me`),
  ]),
  db,
  transmission,
)

// Instantiate services
const stremioAddonRouter = new StremioAddonRouter(streamsProvider)
const downloadRouter = new DownloadRouter(transmission)

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
