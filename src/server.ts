import { serveHTTP } from 'stremio-addon-sdk'
import { addonInterface } from './addon'

serveHTTP(addonInterface, {
  port: (process.env.SERVER_PORT && parseInt(process.env.SERVER_PORT)) || 60421,
})
