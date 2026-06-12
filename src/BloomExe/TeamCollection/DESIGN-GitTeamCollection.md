# GitTeamCollection Design Plan

## Overview

`GitTeamCollection : TeamCollection` is a new subclass that stores book content and status
in a Git repository, initially hosted on GitHub. `FolderTeamCollection` continues to work
unchanged. The `TeamCollectionManager` factory selects the right implementation based on
the link file.

---

## Storage Structure

Books are stored as **unzipped directories** in the Git repository (not as `.bloom` ZIP
archives), one subdirectory per book. Git commits are atomic, so there is no need to zip
files for consistency. Storing books as directories gives native Git diff visibility per
file, and lets us restore any prior version from history.

```
<repoRoot>/
  Books/
    <bookName>/
      <bookName>.htm
      meta.json
      *.png, *.mp3, *.mp4, etc.   (full book contents, unzipped)
      TeamCollection.status        (BookStatus JSON; committed alongside book content)
    <bookName>.deleted             (empty tombstone marker file)
  collection/
    <collection settings files>
    colorPalettes.json
  lost-and-found/
    <bookName>-<timestamp>/        (archived books, one subdirectory per archival event)
      ... (book files at time of archiving)
  .gitattributes                   (configures Git LFS for large binary extensions)
```

**TeamCollection.status** lives as a regular file inside each book's directory in the repo.
It holds the same `BookStatus` JSON as today. It is committed as part of every book write,
and is readable directly from the Git working tree after any sync.

---

## Connection Info

`TeamCollectionLink.txt` (bare folder path) continues to signal a `FolderTeamCollection`.
A new `TeamCollectionLink.json` with `"type": "git"` signals a Git TC:

```json
{
  "type": "git",
  "repoUrl": "https://github.com/org/collection-name",
  "branch": "main"
}
```

Credentials (GitHub PAT or other Git credentials) are handled by the system-level Git
credential manager (Git Credential Manager on Windows, Keychain on macOS). Nothing
credential-related is stored in the link file or committed to the repo.

---

## Git Operations Layer

All Git operations go through a thin interface to keep `GitTeamCollection` testable:

```csharp
internal interface IGitOperations
{
    string RepoPath { get; }
    string RemoteBranch { get; }  // e.g. "origin/main"

    /// Fetch latest from remote into remote-tracking branch (non-destructive locally).
    void Fetch();

    /// Rebase local branch on top of remote-tracking branch.
    /// On conflict: always takes the remote version and discards the local change.
    /// Returns false if a conflict was encountered and resolved by accepting remote.
    bool PullRebase();

    /// Stage all pending changes, commit, and try to push.
    /// Returns false if the push is rejected (non-fast-forward); does NOT auto-pull.
    bool TryCommitAndPush(string commitMessage);

    /// Read a file's content from the remote-tracking branch (not local working tree).
    string ReadFileFromRemote(string repoRelativePath);

    /// List subdirectory or file names at a path in the remote-tracking branch.
    IEnumerable<string> ListRemoteDirectory(string repoRelativePath);

    /// File paths (repo-relative) changed between two commit refs.
    IEnumerable<string> GetChangedFiles(string fromRef, string toRef);

    /// SHA of the current remote-tracking HEAD.
    string GetRemoteHead();
}
```

Concrete implementation: `GitCliOperations` shells out to the system `git` command.
This avoids a native binary dependency and uses the system credential manager automatically.

Alternative to consider if shell-out performance becomes a problem: LibGit2Sharp, a
pure-.NET binding to libgit2. Deferred until benchmarks indicate it is needed.

---

## Abstract Method Implementations

### Book Read/Write

| Method | Implementation |
|--------|----------------|
| `PutBookInRepo(sourceBookFolderPath, newStatus, inLostAndFound, progressCallback)` | Copy all files from sourceBookFolderPath to `Books/<bookName>/`; write `TeamCollection.status` JSON there; stage; commit; `PullRebase()`; `TryCommitAndPush()` with retry on push rejection. If `inLostAndFound`: copy to `lost-and-found/<bookName>-<timestamp>/` instead. |
| `FetchBookFromRepo(destinationCollectionFolder, bookName)` | Ensure recent fetch; copy all files from `Books/<bookName>/` (excluding `TeamCollection.status`) to destinationCollectionFolder; return null on success or an error message. |
| `GetRepoBookFile(bookName, fileName)` | After ensuring recent fetch, read `Books/<bookName>/<fileName>` from the working tree. |
| `GetBookList()` | `ListRemoteDirectory("Books/")` — return subdirectory names, excluding `.deleted` marker files. |
| `IsBookPresentInRepo(bookFolderName)` | Check whether `Books/<bookFolderName>/` exists in the remote-tracking tree. |
| `DeleteBookFromRepo(bookFolderPath, makeTombstone)` | Delete `Books/<bookFolderName>/`; if `makeTombstone`: create empty `Books/<bookFolderName>.deleted`; stage, commit, push. |
| `RenameBookInRepo(newBookFolderPath, oldName)` | `git mv Books/<oldName> Books/<newName>`; commit and push. |
| `MoveRepoBookToLostAndFound(bookName)` | Copy `Books/<bookName>/` to `lost-and-found/<bookName>-<timestamp>/`; delete the original; commit and push. |
| `KnownToHaveBeenDeleted(oldName)` | Check whether `Books/<oldName>.deleted` exists in the remote-tracking tree. |

### Status (Checkout)

| Method | Implementation |
|--------|----------------|
| `GetBookStatusJsonFromRepo(bookFolderName)` | `ReadFileFromRemote("Books/<bookFolderName>/TeamCollection.status")` — reads from the remote-tracking branch so the result always reflects the latest fetch. |
| `TryGetBookStatusJsonFromRepo(bookFolderName, out status, reportFailure)` | Same, catching network/auth/not-found exceptions; return false on error. |
| `WriteBookStatusJsonToRepo(bookName, status)` | Full checkout-race-condition protocol — see section below. |

### Collection Files

| Method | Implementation |
|--------|----------------|
| `PutCollectionFiles(names[])` | Copy the named files to `collection/`; stage, commit, push. |
| `CopyRepoCollectionFilesToLocalImpl(destFolder)` | After fetch, copy all files from `collection/` in working tree to destFolder. |
| `CopyLocalFolderToRepo(folderName)` | Copy local folder contents to `collection/<folderName>/`; stage, commit, push. |
| `GetRepoColorPaletteTime()` | `git log -1 --format=%aI -- collection/colorPalettes.json` — last-commit timestamp. |
| `SyncColorPaletteFileWithRepo(destFolder)` | Fetch; compare timestamps from `GetRepoColorPaletteTime()` vs local file; copy the newer version to the other side if changed. |
| `EnsureConsistentCasingInLocalName(bookBaseName)` | List `Books/` in the remote-tracking tree; find case-insensitive match; rename local directory if its casing differs. |
| `DoLocalAndRemoteNamesDifferOnlyByCase(bookBaseName)` | Same list; return true if there is a match that differs only in case. |

---

## Checkout Race Condition Handling

Two users may simultaneously attempt to check out the same unlocked book. Git's
fast-forward-only push requirement provides the arbitration mechanism: only one user's
commit can win each push round, and the loser receives an explicit push rejection.

### Protocol (used inside `WriteBookStatusJsonToRepo` when status contains a lock)

1. **Fetch** latest from remote.
2. **Read** `Books/<bookName>/TeamCollection.status` from the remote-tracking branch.
   If the book is already checked out, return without writing anything.
3. Write "locked by me" JSON to `Books/<bookName>/TeamCollection.status` in the working tree.
4. Stage and commit.
5. Attempt **push** via `TryCommitAndPush()`.

**Push succeeds:**
- Immediately fetch and re-read the status from the remote-tracking branch.
- If it still says "locked by me": return success.
- If it somehow does not (should be impossible given a successful push): treat as failure,
  reset local status to pre-attempt state.

**Push rejected (non-fast-forward):**
- Fetch to bring the remote-tracking branch up to date.
- Discard the local "locked by me" commit (`git reset --soft HEAD~1`).
- Re-read the remote status. If the book is now locked by someone else: return failure.
- If the remote status is still unlocked (another unrelated commit beat us): retry the
  full protocol once. After two consecutive rejections, report a transient error.

### Rebase conflicts on TeamCollection.status

If `PullRebase()` encounters a merge conflict specifically on a `TeamCollection.status`
file, it always resolves by taking the **remote** version and discarding the local change.
This is correct because the conflict means someone else's checkout commit was already
pushed before ours, making them the rightful holder. After the resolved rebase, re-read
the remote status and report accordingly.

---

## Monitoring

A background polling loop started by `StartMonitoring()`, cancelled by `StopMonitoring()`
(both are already `virtual internal` on the base class — no interface change needed):

- Default poll interval: ~30 seconds.
- Each tick: `git fetch`.
- Compare `origin/main` HEAD SHA to `_lastKnownHead`.
- If changed: call `GetChangedFiles(_lastKnownHead, newHead)` and classify each changed
  path:
  - `Books/<bookName>/TeamCollection.status` or other `Books/<bookName>/*` →
    fire `BookRepoChange`
  - A new `Books/<bookName>/` directory (no prior record) → fire `NewBook`
  - A deleted `Books/<bookName>/` directory or a new `Books/<bookName>.deleted` file →
    fire `DeleteRepoBookFile`
  - Changes under `collection/` → fire `RepoCollectionFilesChanged`
- Update `_lastKnownHead`.

The base-class `HandleRemoteBookChangesOnIdle()` processing is unchanged.

---

## Large Files (Git LFS)

Books may contain large audio/video files. Recommendations:

- **Phase 1**: Accept plain Git objects. Enforce a soft per-book size warning (e.g. 50 MB).
- **Phase 2**: Configure Git LFS in `.gitattributes` for `*.mp3`, `*.mp4`, `*.webm`, `*.wav`,
  `*.ogg`. The TC setup wizard configures LFS on repo initialization.

This does not affect any abstract method signatures.

---

## Changes to Existing Code

### TeamCollectionManager (small)

Replace the hardcoded `new FolderTeamCollection(...)` call(s) with a factory method:

1. Look for `TeamCollectionLink.json` alongside the local collection folder.
2. If found and `"type" == "git"`: instantiate `GitTeamCollection` with the URL and branch.
3. Otherwise fall back to the existing logic (look for `TeamCollectionLink.txt` and
   instantiate `FolderTeamCollection`).

Everything else in the manager (startup sync, event subscriptions, `CurrentCollection`
assignment) is unchanged.

### TeamCollection base class

No interface changes are required. `CheckConnection()` is non-abstract; `GitTeamCollection`
overrides it to verify the remote is reachable and credentials are valid
(e.g. `git ls-remote --exit-code <url>`).

### FolderTeamCollection — untouched.

### TC clients (BookCollection, dialogs, etc.) — untouched.

---

## Rough Implementation Order

1. `IGitOperations` interface + `GitCliOperations` concrete implementation (shell-out).
2. `GitTeamCollection` skeleton with all abstract method stubs; constructor takes
   `localRepoPath`, `repoUrl`, `branch`.
3. Read-side methods: `GetBookList`, `IsBookPresentInRepo`, `GetBookStatusJsonFromRepo`,
   `TryGetBookStatusJsonFromRepo`, `FetchBookFromRepo`, `GetRepoBookFile`,
   `KnownToHaveBeenDeleted`.
4. Write-side methods: `PutBookInRepo`, `WriteBookStatusJsonToRepo`, `DeleteBookFromRepo`,
   `RenameBookInRepo`, `MoveRepoBookToLostAndFound`.
5. Collection-files methods: `PutCollectionFiles`, `CopyRepoCollectionFilesToLocalImpl`,
   `CopyLocalFolderToRepo`, `SyncColorPaletteFileWithRepo`, `GetRepoColorPaletteTime`,
   `EnsureConsistentCasingInLocalName`, `DoLocalAndRemoteNamesDifferOnlyByCase`.
6. Full checkout race-condition protocol in `WriteBookStatusJsonToRepo` and `CheckConnection`
   override.
7. Background monitoring loop.
8. `TeamCollectionManager` factory (detect link-file type).
9. Collection setup/join UI ("Connect to Git TC" dialog, repo initialization).
10. Integration tests against a local bare repo (no network required).
11. Integration tests against a real GitHub repo.

---

## Open Questions

1. **Git library**: Shell-out to `git` CLI vs LibGit2Sharp.
   CLI is simpler for authentication; LibGit2Sharp gives better testability and avoids
   process-launch overhead per operation. Recommendation: CLI for Phase 1.

2. **Large files**: Configure Git LFS at setup time or defer to Phase 2?
   LFS requires additional server support; GitHub provides it for free up to 1 GB/month.

3. **Branch strategy**: Single `main` branch for all operations (simple, recommended)
   vs per-book branches (allows more parallel pushes but complicates monitoring and merges).

4. **Credential distribution**: How does a new team member get access?
   - GitHub repository invite (requires a GitHub account per user)
   - Embedded read-write PAT in the `.JoinBloomTC` file (security concern)
   - GitHub OAuth flow within Bloom (cleanest UX; more implementation work)

5. **Repo initialization**: Does Bloom create and push the initial empty repo to GitHub,
   or does the collection admin create it manually and paste the URL into Bloom?

6. **Push retry strategy**: How many retries on push rejection before surfacing an error
   to the user? Recommendation: 3 retries for normal book writes, 2 for checkout status.

7. **Offline / disconnected behavior**: If the remote is unreachable, fall back to
   `DisconnectedTeamCollection` (same as today). The local clone still holds the
   last-fetched state, so read-only operations can continue.

8. **Repo per collection vs monorepo**: Each team collection maps to exactly one Git repo
   (recommended). Submodule-based monorepos are not worth the complexity.
