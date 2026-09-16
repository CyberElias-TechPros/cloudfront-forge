-- One platform role per user.
--
-- `admin_users` never had a uniqueness constraint on user_id, so a role
-- upsert (`ON CONFLICT(user_id)`) was impossible and duplicate role rows were
-- silently allowed. Deduplicate first (keeping the most privileged row,
-- lowest rowid wins ties), then add the unique index the role-change endpoint
-- relies on. Written without a DELETE alias: SQLite only accepts aliased
-- deletes when compiled with SQLITE_ENABLE_UPDATE_DELETE_LIMIT.

DELETE FROM admin_users
 WHERE EXISTS (
   SELECT 1 FROM admin_users b
    WHERE b.user_id = admin_users.user_id
      AND (
        CASE b.role WHEN 'super_admin' THEN 3 WHEN 'admin' THEN 2 ELSE 1 END
        > CASE admin_users.role WHEN 'super_admin' THEN 3 WHEN 'admin' THEN 2 ELSE 1 END
        OR (
          CASE b.role WHEN 'super_admin' THEN 3 WHEN 'admin' THEN 2 ELSE 1 END
          = CASE admin_users.role WHEN 'super_admin' THEN 3 WHEN 'admin' THEN 2 ELSE 1 END
          AND b.rowid < admin_users.rowid
        )
      )
 );

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_users_user ON admin_users(user_id);
