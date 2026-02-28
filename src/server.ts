import express from 'express'
import { getRouter } from 'stremio-addon-sdk'
import { addonInterface } from './addon.js'
import { addTorrent } from './transmission.js'

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/download/:infoHash', async (req, res) => {
  const url = req.query.url as string
  if (url) {
    await addTorrent(url)
    console.log(`Added torrent: ${req.params.infoHash}`)
    res.send('Torrent added to Transmission!')
  } else {
    res.status(400).send('Missing url')
  }
})

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`)
  next()
})

app.use(getRouter(addonInterface))

const port = (process.env.SERVER_PORT && parseInt(process.env.SERVER_PORT)) || 60421
app.listen(port, () => {
  console.log(`Addon running on http://localhost:${port}`)
})
