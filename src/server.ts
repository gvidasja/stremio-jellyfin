import express from 'express'
import { Addon } from './addon.js'
import { DB } from './db.js'
import { DownloadRouter } from './download-router.js'
import { Jellyfin } from './jellyfin.js'
import { Torrentio } from './torrentio.js'
import { Transmission } from './transmission.js'

const app = express()

// Jellyfin Config
const jellyfinServer = process.env.JELLYFIN_SERVER || 'http://localhost:8096'
const jellyfinUser = process.env.JELLYFIN_USER || 'username'
const jellyfinPassword = process.env.JELLYFIN_PASSWORD || 'password'

// Torrentio Config
const torrentioSettings =
  process.env.TORRENTIO_SETTINGS ||
  'providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex,mejortorrent,wolfmax4k,besttorrents|qualityfilter=threed,720p,480p,scr,cam,unknown|limit=2'

// Transmission Config
const transmissionUrl = process.env.TRANSMISSION_URL || 'http://localhost:9091'
const transmissionUser = process.env.TRANSMISSION_USER
const transmissionPassword = process.env.TRANSMISSION_PASSWORD
const transmissionDownloadDir =
  process.env.TRANSMISSION_DOWNLOAD_DIR || '/srv/transmission/downloads'

// DB Configuration
const dbPath = process.env.DB_PATH || 'cache.sqlite'

// Instantiate dependencies
const db = new DB(dbPath)
const jellyfin = new Jellyfin(jellyfinServer, jellyfinUser, jellyfinPassword)
const torrentio = new Torrentio(torrentioSettings)
const transmission = new Transmission(
  transmissionUrl,
  transmissionUser,
  transmissionPassword,
  transmissionDownloadDir,
)

// Instantiate services
const stremioAddonRouter = new Addon(jellyfin, torrentio, db, transmission)
const downloadRouter = new DownloadRouter(transmission)

// Build Stremio Addon
app.use(stremioAddonRouter.routes())

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(downloadRouter.router())

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`)
  next()
})

const port = (process.env.SERVER_PORT && parseInt(process.env.SERVER_PORT)) || 60421
app.listen(port, () => {
  console.log(`Addon running on http://localhost:${port}`)
})
