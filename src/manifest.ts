import { Manifest } from 'stremio-addon-sdk'

export const manifest: Manifest = {
  id: 'community.stremiojellyfin',
  version: '1.0.0',
  catalogs: [
    {
      name: 'Movie',
      type: 'movie',
      id: 'all',
      extra: [
        {
          name: 'skip',
          isRequired: true,
        },
        {
          name: 'search',
          isRequired: false,
        },
      ],
    },
    {
      name: 'Series',
      type: 'series',
      id: 'all',
      extra: [
        {
          name: 'skip',
          isRequired: true,
        },
        {
          name: 'search',
          isRequired: false,
        },
      ],
    },
  ],
  resources: ['catalog', 'stream'],
  types: ['movie', 'series'],
  name: 'Jellyfin',
  description: 'Stremio Jellyfin integration',
}
