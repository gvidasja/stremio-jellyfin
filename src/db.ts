import { Database } from 'bun:sqlite'

export class DB {
  private db: Database

  constructor(dbPath: string = 'cache.sqlite') {
    this.db = new Database(dbPath, { create: true })
    this.db
      .query('CREATE TABLE IF NOT EXISTS torrents (infoHash TEXT PRIMARY KEY, name TEXT)')
      .run()
  }

  upsertTorrent(infoHash: string, name: string) {
    this.db
      .query('INSERT OR REPLACE INTO torrents (infoHash, name) VALUES ($infoHash, $name)')
      .run({
        $infoHash: infoHash.toLowerCase(),
        $name: name,
      })
  }

  getTorrentName(infoHash: string): string | undefined {
    const row = this.db.query('SELECT name FROM torrents WHERE infoHash = $infoHash').get({
      $infoHash: infoHash.toLowerCase(),
    }) as { name: string } | null

    return row?.name
  }
}
