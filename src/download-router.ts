import express from 'express'
import { resolveSubDir } from './stream-helpers.js'
import { Transmission } from './transmission.js'

export class DownloadRouter {
  constructor(private transmission: Transmission) {}

  public router() {
    const router = express.Router()

    router.get('/download/:infoHash', async (req, res) => {
      const url = req.query.url as string
      const type = req.query.type as string
      const imdbId = req.query.imdbId as string

      if (url && type && imdbId) {
        const subDir = await resolveSubDir(type, imdbId)
        await this.transmission.addTorrent(url, subDir)
        console.log(`Added torrent: ${req.params.infoHash}`)
        res.send('Torrent added to Transmission!')
      } else {
        res.status(400).send('Missing url, type, or imdbId')
      }
    })

    return router
  }
}
