import type { Env } from "../types";
import { Database } from "../lib/database";

export class UserService {
  private db: Database;

  constructor(env: Env) {
    this.db = new Database(env);
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
