# Stremio Jellyfin Addon

[Stremio](https://www.stremio.com/) addon that enables streaming movies and TV series from your own Jellyfin server. Addon runs entirely locally, ensuring that none of your data is shared outside of your own network. It provides Stremio with a 'library' featuring your Jellyfin movies and TV series collection, allowing you to stream seamlessly both movies and series to your favorite Stremio player.

## Installation

To run this addon follow these steps:

1. Create `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Run the addon:
   ```bash
   bun run src/server.ts
   ```

Finally, add the manifest to Stremio to install this addon:

`http://{YOUR_SERVER_HOSTNAME}:60421/manifest.json`
