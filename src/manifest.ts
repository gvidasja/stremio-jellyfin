import { Manifest } from 'stremio-addon-sdk'

export const manifest: Manifest = {
  id: 'community.stremiojellyfin',
  version: '1.0.0',
  catalogs: [],
  resources: ['stream'],
  types: ['movie', 'series'],
  name: 'Jellyfin',
  description: 'Stremio Jellyfin integration',
}
