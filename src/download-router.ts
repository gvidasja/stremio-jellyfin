import express from 'express'
import { Transmission } from './transmission.ts'

export class DownloadRouter {
  constructor(private transmission: Transmission) {}

  private async resolveSubDir(type: string, imdbId: string): Promise<string> {
    if (type === 'movie') {
      return 'movies'
    }

    if (type !== 'series') {
      return ''
    }

    const seriesId = imdbId.split(':')[0]
    let showName = 'unknown-show'
    try {
      const res = await fetch(`https://v3-cinemeta.strem.io/meta/series/${seriesId}.json`)
      if (res.ok) {
        const data = await res.json()
        if (data?.meta?.name) {
          showName = data.meta.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
        }
      }
    } catch (e) {}

    return `tv/${showName}`
  }

  public router() {
    const router = express.Router()

    router
      .use(express.json())
      .use(express.urlencoded({ extended: true }))
      .get('/download/:infoHash', async (req, res) => {
        const url = req.query.url as string
        const type = req.query.type as string
        const imdbId = req.query.imdbId as string

        if (url && type && imdbId) {
          const subDir = await this.resolveSubDir(type, imdbId)
          await this.transmission.addTorrent(url, subDir)
          console.log(`added torrent: ${req.params.infoHash}`)
          res.send('Torrent added to Transmission!')
        } else {
          res.status(400).send('Missing url, type, or imdbId')
        }
      })

    return router
  }
}
