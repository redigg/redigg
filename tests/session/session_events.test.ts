import { afterAll, describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import { SQLiteStorage } from '../../src/storage/sqlite.js';
import { SessionManager } from '../../src/session/SessionManager.js';

const dbPath = path.join(os.tmpdir(), `redigg-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);

describe('Session event replay store', () => {
  const storage = new SQLiteStorage(dbPath);
  const sessions = new SessionManager(storage);

  afterAll(() => {
    storage.close();
    try {
      fs.rmSync(dbPath, { force: true });
    } catch {}
  });

  it('appends and replays events since an id', () => {
    const session = sessions.createSession('u1');

    const id1 = sessions.appendEvent(session.id, 'todo', { id: 't1', status: 'in_progress' });
    const id2 = sessions.appendEvent(session.id, 'plan', { steps: [{ id: 's1' }] });

    expect(id2).toBeGreaterThan(id1);

    const all = sessions.getEventsSince(session.id, 0);
    expect(all.length).toBe(2);
    expect(all[0].id).toBe(id1);
    expect(all[0].type).toBe('todo');
    expect(all[0].content).toEqual({ id: 't1', status: 'in_progress' });

    const tail = sessions.getEventsSince(session.id, id1);
    expect(tail.length).toBe(1);
    expect(tail[0].id).toBe(id2);
    expect(tail[0].type).toBe('plan');
  });
});

