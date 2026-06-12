# CloudTeamCollection Design Plan

## Overview

`CloudTeamCollection : TeamCollection` is a new subclass that stores book content on S3
and book status/metadata in a remote transactional database. `FolderTeamCollection` continues
to work unchanged. The two can coexist; the `TeamCollectionManager` factory selects the
right implementation based on the link file.

---

## Storage Backends

- **S3** — zipped `.bloom` book files
- **Remote database** (Parse Server or REST-over-SQLite) — `BookStatus` JSON and collection metadata

A **generation UUID** is generated on every upload. The database record for a book always
points to the current generation. The database record is never written until the S3 upload
completes, so a reader can never see a partially-uploaded file. Old generations are deleted
after the database update plus a configurable safety delay.

---

## S3 Key Structure

```
{collectionId}/books/{bookName}/{generation}.bloom
{collectionId}/lost-and-found/{bookName}-{timestamp}-{generation}.bloom
{collectionId}/collection/files/{generation}.zip
{collectionId}/collection/folders/{folderName}/{generation}.zip
```

---

## Database Schema

```
BookRecord
  collectionId       : string   (index)
  bookName           : string   (unique within collection)
  generation         : string   (UUID of current S3 object)
  statusJson         : string   (full BookStatus JSON blob — same format as today)
  isDeleted          : bool     (tombstone)
  isLostAndFound     : bool
  updatedAt          : datetime (server-set; used by the polling monitor)
  previousGeneration : string?  (cleared after safety delay)

CollectionFilesRecord
  collectionId       : string   (PK)
  filesGeneration    : string
  updatedAt          : datetime
  colorPalettesJson  : string?  (tiny; kept in DB)
```

**Atomic checkout**: conditional write — "update only if `generation == expected` AND `lockedBy IS NULL`".
Parse uses `$and` query + atomic save; SQLite uses `UPDATE … WHERE … checking rows-affected`.

---

## CloudTeamCollection — Abstract Method Implementations

| Method | Implementation |
|---|---|
| `PutBookInRepo()` | New generation UUID → zip → S3 upload → DB conditional update → schedule old-gen S3 delete |
| `TryGetBookStatusJsonFromRepo()` | DB query by `(collectionId, bookName)`, catches network/auth errors |
| `GetBookStatusJsonFromRepo()` | Same, propagates exceptions |
| `WriteBookStatusJsonToRepo()` | DB update of `statusJson` only; no S3 touch |
| `FetchBookFromRepo()` | DB lookup for current generation → S3 download → unzip |
| `GetRepoBookFile()` | S3 download → extract single entry |
| `GetBookList()` | DB query: all non-deleted records for collection |
| `DeleteBookFromRepo()` | DB `isDeleted = true`; schedule S3 delete |
| `RenameBookInRepo()` | DB `bookName` update; new checkin picks up new name |
| `IsBookPresentInRepo()` | DB exists check |
| `KnownToHaveBeenDeleted()` | DB `isDeleted == true` check |
| `MoveRepoBookToLostAndFound()` | S3 copy to lost-and-found key → DB update |
| `PutCollectionFiles()` | Zip → S3 → DB update for `CollectionFilesRecord` |
| `CopyRepoCollectionFilesToLocalImpl()` | DB lookup generation → S3 download → unzip |
| `CopyLocalFolderToRepo()` | Zip folder → S3 upload with folder key → DB update |
| `EnsureConsistentCasingInLocalName()` | DB query for stored name; rename local dir if case differs |
| `DoLocalAndRemoteNamesDifferOnlyByCase()` | Compare DB-stored name with local |
| `GetRepoColorPaletteTime()` | Return `CollectionFilesRecord.updatedAt` |

---

## Monitoring (Replaces FileSystemWatcher)

A background polling loop (started in `StartMonitoring()`, cancelled in `StopMonitoring()`):
- Default interval: ~30 seconds
- Query: `BookRecord WHERE collectionId = X AND updatedAt > lastPolledAt`
- Fires the same `BookRepoChange` / `NewBook` / `DeleteRepoBookFile` events as today
- Base class `HandleRemoteBookChangesOnIdle()` processing is unchanged
- Parse Live Queries could replace polling if a push-based approach is preferred later

`StartMonitoring()` and `StopMonitoring()` are already `virtual internal` — no interface change needed.

---

## Connection Info

`TeamCollectionLink.txt` (bare folder path) continues to signal a `FolderTeamCollection`.
A new `TeamCollectionLink.json` signals a cloud TC:

```json
{
  "type": "cloud",
  "collectionId": "...",
  "databaseUrl": "https://...",
  "databaseAppId": "...",
  "s3BucketName": "...",
  "s3Region": "us-east-1"
}
```

Credentials (DB API key, S3 access key/secret) are stored in the user's system keychain or
a local secrets file that is never committed or synced.

---

## Dependency Injection / Layering

Two thin interfaces keep `CloudTeamCollection` testable:

```csharp
internal interface IBookStorage
{
    Task UploadAsync(string key, Stream data);
    Task<Stream> DownloadAsync(string key);
    Task DeleteAsync(string key);
    Task CopyAsync(string sourceKey, string destKey);
}

internal interface IBookStatusDb
{
    Task<BookRecord> GetBookAsync(string collectionId, string bookName);
    Task<IList<BookRecord>> GetAllBooksAsync(string collectionId);
    // Returns false if the conditional write failed (another client updated first)
    Task<bool> TryUpdateBookAsync(BookRecord record, string expectedGeneration);
    Task<IList<BookRecord>> GetChangedSinceAsync(string collectionId, DateTime since);
    // Collection files equivalents ...
}
```

Concrete implementations: `S3BookStorage`, `ParseBookStatusDb` / `SqliteRestBookStatusDb`.

---

## Changes to Existing Code

### TeamCollectionManager (small)
Replace the two hardcoded `new FolderTeamCollection(...)` calls with a factory method that
reads the link file type and instantiates the correct subclass. Everything else in the manager
(startup sync, event subscriptions, `CurrentCollection` assignment) is unchanged.

### TeamCollection base class (minimal)
No interface changes are required. `CheckConnection()` is non-abstract; `CloudTeamCollection`
overrides it to test S3 bucket accessibility and DB connectivity.

### FolderTeamCollection — untouched.

### TC clients (BookCollection, dialogs, etc.) — untouched.

---

## Rough Implementation Order

1. `IBookStorage` + `IBookStatusDb` interfaces and `BookRecord` DTO
2. `CloudTeamCollection` skeleton with all abstract method stubs
3. `S3BookStorage` (AWS SDK for .NET)
4. `ParseBookStatusDb` or `SqliteRestBookStatusDb`
5. Fill in `CloudTeamCollection` method bodies
6. Manager factory (detect link file type, instantiate correct TC)
7. Connection setup UI ("Connect to Cloud TC" dialog)
8. Polling monitor loop
9. Integration tests against dev S3 + DB

---

## Open Questions

1. **Database backend**: Parse Server (self-hosted or hosted) vs Turso/LibSQL vs custom REST endpoint?
   Parse has Live Queries (true push), which could eliminate polling.
2. **Credential distribution**: How do users get S3/DB credentials when joining?
   Embedded in the `.JoinBloomTC` file? A separate onboarding step?
3. **Safety delay for old S3 generation deletion**: Fixed time (e.g., 5 minutes), or track
   in the DB that all known clients have acknowledged the new generation?
4. **Link file naming**: Rename to `TeamCollectionLink.json`, or keep `.txt` with JSON content
   (and detect format from content)?
