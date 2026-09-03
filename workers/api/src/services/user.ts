import type { Env } from "../types";
import { Database } from "../lib/database";

export class UserService {
  private db: Database;

  constructor(env: Env) {
    this.db = new Database(env);
  }

  async getOrCreateUser(
    firebaseUid: string,
    email: string | null,
    displayName: string | null,
    photoUrl: string | null,
  ): Promise<any | null> {
    const existing = await this.db.querySingle(
      "SELECT * FROM users WHERE firebase_uid = ? AND deleted_at IS NULL",
      [firebaseUid],
    );

    if (existing) {
      await this.db.execute("UPDATE users SET last_active = ? WHERE firebase_uid = ?", [
        new Date().toISOString(),
        firebaseUid,
      ]);
      return existing;
    }

    const userId = this.db.uuid();
    const now = this.db.now();

    const result = await this.db.execute(
      `INSERT INTO users (id, firebase_uid, email, email_verified, display_name, photo_url, created_at, updated_at, last_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        firebaseUid,
        email ?? null,
        false,
        displayName ?? null,
        photoUrl ?? null,
        now,
        now,
        now,
      ],
    );

    if (!result.success) {
      return null;
    }

    return this.getUser(userId);
  }

  async getUser(userId: string): Promise<any | null> {
    return await this.db.querySingle("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL", [
      userId,
    ]);
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<any | null> {
    return await this.db.querySingle(
      "SELECT * FROM users WHERE firebase_uid = ? AND deleted_at IS NULL",
      [firebaseUid],
    );
  }

  async updateUser(userId: string, data: Record<string, any>): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key !== "id" && key !== "firebaseUid" && key !== "createdAt") {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return true;

    values.push(new Date().toISOString()); // updated_at
    values.push(userId);

    const result = await this.db.execute(
      `UPDATE users SET ${fields.join(", ")}, updated_at = ? WHERE id = ?`,
      values,
    );

    return result.success;
  }
}
