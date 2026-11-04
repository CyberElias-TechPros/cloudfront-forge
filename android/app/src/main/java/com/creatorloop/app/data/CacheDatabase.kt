package com.creatorloop.app.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "snapshots", primaryKeys = ["owner", "key"])
data class SnapshotEntity(val owner: String, val key: String, val payload: String, val savedAt: Long)

@Entity(tableName = "outbox", primaryKeys = ["id"])
data class OutboxEntity(val id: String, val owner: String, val kind: String, val resourceId: String, val createdAt: Long, val attempts: Int = 0, val lastError: String? = null)

@Dao
interface CacheDao {
    @Query("SELECT * FROM snapshots WHERE `owner` = :owner AND `key` = :key") suspend fun snapshot(owner: String, key: String): SnapshotEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun putSnapshot(snapshot: SnapshotEntity)
    @Query("DELETE FROM snapshots WHERE `owner` = :owner") suspend fun clearOwner(owner: String)
    @Query("DELETE FROM snapshots WHERE `owner` = :owner AND `key` LIKE :prefix || '%'") suspend fun invalidate(owner: String, prefix: String)
    @Query("DELETE FROM snapshots") suspend fun clearAll()
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun enqueue(item: OutboxEntity)
    @Query("SELECT * FROM outbox WHERE `owner` = :owner ORDER BY createdAt LIMIT 100") suspend fun pending(owner: String): List<OutboxEntity>
    @Query("SELECT * FROM outbox ORDER BY createdAt LIMIT 100") suspend fun allPending(): List<OutboxEntity>
    @Query("DELETE FROM outbox WHERE id = :id") suspend fun remove(id: String)
    @Query("UPDATE outbox SET attempts = attempts + 1, lastError = :error WHERE id = :id") suspend fun failed(id: String, error: String)
    @Query("DELETE FROM outbox WHERE `owner` = :owner") suspend fun clearOutbox(owner: String)
    @Query("DELETE FROM outbox") suspend fun clearAllOutbox()
    @Query("SELECT COUNT(*) FROM outbox WHERE `owner` = :owner") fun pendingCount(owner: String): Flow<Int>
}

@Database(entities = [SnapshotEntity::class, OutboxEntity::class], version = 1, exportSchema = true)
abstract class CacheDatabase : RoomDatabase() { abstract fun cacheDao(): CacheDao }
