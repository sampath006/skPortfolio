// D1 (SQLite) helpers. Tables are created on first use, so there is no
// separate database setup step.

let ready = false;

export async function prepare(db: any): Promise<void> {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL)'),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL)',
    ),
    db.prepare('CREATE TABLE IF NOT EXISTS rate (key TEXT NOT NULL, bucket INTEGER NOT NULL, hits INTEGER NOT NULL, PRIMARY KEY (key, bucket))'),
    db.prepare('CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, who TEXT NOT NULL, action TEXT NOT NULL, detail TEXT, at TEXT NOT NULL)'),
  ]);
  ready = true;
}

// Fixed-window rate limit. Returns true while the caller is under the limit.
// Without a database there is nothing to count with, so the request is allowed.
export async function allow(db: any, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!db) return true;
  await prepare(db);
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const row = await db
    .prepare('INSERT INTO rate (key, bucket, hits) VALUES (?1, ?2, 1) ON CONFLICT(key, bucket) DO UPDATE SET hits = hits + 1 RETURNING hits')
    .bind(key, bucket)
    .first();
  // Old windows are useless; clear them out now and then.
  if (Math.random() < 0.02) await db.prepare('DELETE FROM rate WHERE bucket < ?1').bind(bucket - 1).run();
  return (row?.hits ?? 1) <= limit;
}

export async function audit(db: any, who: string, action: string, detail = ''): Promise<void> {
  if (!db) return;
  await prepare(db);
  await db.prepare('INSERT INTO audit (who, action, detail, at) VALUES (?1, ?2, ?3, ?4)').bind(who, action, detail, new Date().toISOString()).run();
}
