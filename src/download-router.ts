import express from 'express'
import { Qbittorrent, TorrentFile } from './qbittorrent.ts'

export class DownloadRouter {
  constructor(private qbittorrent: Qbittorrent) {}

  public router() {
    const router = express.Router()

    router
      .use(express.json())
      .use(express.urlencoded({ extended: true }))
      .get('/download/:infoHash', async (req, res) => {
        const url = req.query.url as string
        const infoHash = req.params.infoHash as string

        if (!url || !infoHash) {
          return res.status(400).send('Missing url or infoHash')
        }

        // Add to qBittorrent
        await this.qbittorrent.addTorrent(url, infoHash)
        console.log(`added torrent: ${infoHash}`)

        const fileIdxStr = req.query.fileIdx as string | undefined
        const fileIdx = fileIdxStr ? parseInt(fileIdxStr, 10) : undefined

        // Poll for files up to 10 seconds to find the exact file or largest video file
        let targetFile: TorrentFile | null = null
        let targetIdx: number = -1

        for (let i = 0; i < 20; i++) {
          const files = await this.qbittorrent.getFiles(infoHash)
          if (files && files.length > 0) {
            if (fileIdx !== undefined && !isNaN(fileIdx) && files.length > fileIdx) {
              targetFile = files[fileIdx]
              targetIdx = fileIdx
              break
            } else {
              const videoFiles = files.filter(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv'))
              if (videoFiles.length > 0) {
                targetFile = videoFiles.sort((a, b) => b.size - a.size)[0]
                targetIdx = files.indexOf(targetFile)
                break
              }
            }
          }
          await new Promise(r => setTimeout(r, 500))
        }

        if (targetFile && targetIdx !== -1) {
          // Optimization: Do not download other files (e.g. other episodes in a season pack).
          // We set priority to 0 for all other files, and 7 (max) for the target file.
          // qBittorrent preserves files that are already completed, but stops downloading priority 0 files.
          const files = await this.qbittorrent.getFiles(infoHash)
          const skipIds = files
            .map((_, idx) => idx)
            .filter(idx => idx !== targetIdx)
            .join('|')

          if (skipIds) {
            await this.qbittorrent.setFilePrio(infoHash, skipIds, 0)
          }
          await this.qbittorrent.setFilePrio(infoHash, targetIdx.toString(), 7)

          const encodedName = targetFile.name.split('/').map(encodeURIComponent).join('/')
          const streamUrl = `http://192.168.0.114:8090/stream/${infoHash}/${encodedName}`
          console.log(`redirecting to ${streamUrl}`)
          return res.redirect(302, streamUrl)
        } else {
          return res.status(404).send('Could not find video files in torrent within timeout.')
        }
      })

    return router
  }
}
