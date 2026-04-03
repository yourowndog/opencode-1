# Phase 4: Integration Testing

> **Goal**: Verify end-to-end sync across real machines in the Brokentooth cluster. Confirm sessions created on one machine appear on another after sync.
>
> **Depends on**: Phase 2 (sync server on beksinski), Phase 3 (sync client in opencode)
> **Estimated sessions**: 1-2
> **Next**: Phase 5 (Polish)

---

## Context

At this point the sync server is running on beksinski and the sync client is wired into opencode. This phase is pure testing — no new code unless bugs are found.

---

## Test Matrix

### Test 1: Basic Sync (pyrrhus → titan)

**Setup**:
- pyrrhus and titan both have opencode-fork built with sync enabled
- Both configured to sync to beksinski
- pyrrhus: `"source": "pyrrhus"` in opencode.json
- titan: `"source": "titan"` in opencode.json

**Steps**:
1. On pyrrhus: Start opencode, create a new session
2. Send 2-3 messages (get AI responses)
3. Close the session (exit opencode) — this triggers push
4. Verify on beksinski: `curl -u opencode:<pass> https://<sync-url>/sync/sessions` — session should appear
5. On titan: Start opencode — pull triggers on start
6. Run `opencode session list` on titan — the pyrrhus session should appear
7. Open the session on titan — messages should be present with full content

**Expected**: Session with all messages visible on titan. Message content, parts, tool calls all intact.

### Test 2: Round-Trip (pyrrhus → titan → pyrrhus)

1. Continue from Test 1: the session is now on titan
2. On titan: Resume the session, send 1-2 more messages
3. Close opencode on titan — push triggers
4. On pyrrhus: Start opencode — pull triggers
5. Open the session — should now have messages from both machines

**Expected**: Full conversation history from both machines in correct order.

### Test 3: Offline Resilience

1. On pyrrhus: Disconnect from internet (disable Wi-Fi or block beksinski IP)
2. Create a new session, send messages
3. Close session — push should fail silently (log warning, no crash)
4. Reconnect to internet
5. Start opencode again — push should now succeed
6. Verify session appears on beksinski

**Expected**: No crashes during offline work. Sync catches up on reconnect.

### Test 4: Sequence Conflict Detection

1. On pyrrhus: Create session, send 2 messages, close (push)
2. On titan: Pull the session
3. On BOTH machines simultaneously: open the same session, send a message, close
4. One push will succeed, the other should get a sequence error from the sync server

**Expected**: One push succeeds, the other fails with a clear error message. No data corruption. The failed machine should be able to pull and see the other's changes, then retry.

### Test 5: Large Session

1. Create a session with 50+ messages (or use a session with large tool outputs — file reads, diffs)
2. Push to beksinski
3. Pull on another machine
4. Verify all messages and parts are intact

**Expected**: No truncation, no corruption. May be slow — note timing for future optimization.

### Test 6: Multiple Sessions

1. On pyrrhus: Create 5 sessions with various content
2. Close all, push
3. On titan: Start opencode, pull
4. Verify all 5 sessions appear with correct content

**Expected**: All sessions sync independently.

---

## Verification Commands

```bash
# Check sync server state
curl -u opencode:<pass> https://<sync-url>/sync/health
curl -u opencode:<pass> https://<sync-url>/sync/sessions

# Check local event table
sqlite3 ~/.local/share/opencode/opencode.db "SELECT COUNT(*) FROM event"
sqlite3 ~/.local/share/opencode/opencode.db "SELECT type, aggregate_id, seq FROM event ORDER BY id LIMIT 20"

# Check local sync state
sqlite3 ~/.local/share/opencode/opencode.db "SELECT * FROM sync_state"

# Check sessions
sqlite3 ~/.local/share/opencode/opencode.db "SELECT id, title, directory FROM session"

# Compare session counts across machines
ssh sam@pyrrhus "sqlite3 ~/.local/share/opencode/opencode.db 'SELECT COUNT(*) FROM session'"
ssh sam@titan "sqlite3 ~/.local/share/opencode/opencode.db 'SELECT COUNT(*) FROM session'"
```

---

## Common Issues & Debugging

| Symptom | Likely Cause | Fix |
|---|---|---|
| Push fails with 401 | Auth mismatch | Check opencode.json sync.auth matches server env |
| Push fails with sequence error | Events out of order | Check local event table seq values; may need to pull first |
| Pull succeeds but sessions empty | Projectors not loaded | Ensure `initProjectors()` runs before pull |
| Pull replays but data wrong | Projector bug | Compare event data JSON against expected table state |
| Session appears but messages missing | Message events not defined | Phase 1 gap — message CRUD not going through events |
| Network timeout | beksinski unreachable | Check DNS, firewall, systemd service on beksinski |

---

## Definition of Done

- [ ] Test 1 passes: session syncs pyrrhus → beksinski → titan
- [ ] Test 2 passes: round-trip sync works
- [ ] Test 3 passes: offline work + reconnect sync
- [ ] Test 4 passes: sequence conflicts detected cleanly
- [ ] Test 5 passes: large sessions sync without corruption
- [ ] Test 6 passes: multiple sessions sync independently
- [ ] All issues found are documented with fixes or tracked as bugs
- [ ] Update status in `docs/sync/COLD_BOOT.md`

---

## Handoff to Phase 5

Phase 5 needs:
- Confirmation of which tests pass/fail
- Performance notes (how long does a 50-message sync take?)
- Any edge cases discovered
- List of UX issues (confusing errors, missing feedback, etc.)
