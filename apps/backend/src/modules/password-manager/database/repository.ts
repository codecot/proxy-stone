import { DatabaseAdapter } from "../../../database/types.js";
import { CredentialData } from "../services/csv-import.js";
import { CREDENTIALS_SCHEMA } from "./schema.js";

export interface CredentialFilter {
  category?: string;
  status?: string;
  importance?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export class CredentialsRepository {
  private readonly tableName = "credentials";

  constructor(private db: DatabaseAdapter) {}

  async initialize(): Promise<void> {
    // Create table if it doesn't exist
    if (!(await this.db.tableExists(this.tableName))) {
      await this.db.createTable(this.tableName, CREDENTIALS_SCHEMA);
    }
  }

  async create(credential: CredentialData): Promise<void> {
    const sql = `
      INSERT INTO ${this.tableName} (
        id, login, password, url, category, importance, status,
        change_password_url, screenshot, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      credential.id,
      credential.login,
      credential.password,
      credential.url,
      credential.category,
      credential.importance,
      credential.status,
      credential.changePasswordUrl || null,
      credential.screenshot || null,
      JSON.stringify(credential.tags),
      credential.createdAt,
      credential.updatedAt,
    ];

    await this.db.execute(sql, params);
  }

  async findById(id: string): Promise<CredentialData | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const results = await this.db.query<any>(sql, [id]);

    if (results.length === 0) {
      return null;
    }

    return this.mapRowToCredential(results[0]);
  }

  async findAll(filter: CredentialFilter = {}): Promise<CredentialData[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];
    const conditions: string[] = [];

    // Apply filters
    if (filter.category) {
      conditions.push("category = ?");
      params.push(filter.category);
    }

    if (filter.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }

    if (filter.importance !== undefined) {
      conditions.push("importance = ?");
      params.push(filter.importance);
    }

    if (filter.search) {
      conditions.push("(login LIKE ? OR url LIKE ? OR tags LIKE ?)");
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += " ORDER BY created_at DESC";

    if (filter.limit) {
      sql += ` LIMIT ${filter.limit}`;
      if (filter.offset) {
        sql += ` OFFSET ${filter.offset}`;
      }
    }

    const results = await this.db.query<any>(sql, params);
    return results.map((row) => this.mapRowToCredential(row));
  }

  async update(id: string, updates: Partial<CredentialData>): Promise<boolean> {
    const setClause: string[] = [];
    const params: any[] = [];

    // Build SET clause dynamically
    if (updates.login !== undefined) {
      setClause.push("login = ?");
      params.push(updates.login);
    }
    if (updates.password !== undefined) {
      setClause.push("password = ?");
      params.push(updates.password);
    }
    if (updates.url !== undefined) {
      setClause.push("url = ?");
      params.push(updates.url);
    }
    if (updates.category !== undefined) {
      setClause.push("category = ?");
      params.push(updates.category);
    }
    if (updates.importance !== undefined) {
      setClause.push("importance = ?");
      params.push(updates.importance);
    }
    if (updates.status !== undefined) {
      setClause.push("status = ?");
      params.push(updates.status);
    }
    if (updates.changePasswordUrl !== undefined) {
      setClause.push("change_password_url = ?");
      params.push(updates.changePasswordUrl);
    }
    if (updates.screenshot !== undefined) {
      setClause.push("screenshot = ?");
      params.push(updates.screenshot);
    }
    if (updates.tags !== undefined) {
      setClause.push("tags = ?");
      params.push(JSON.stringify(updates.tags));
    }

    if (setClause.length === 0) {
      return false; // No updates provided
    }

    // Always update the updated_at timestamp
    setClause.push("updated_at = ?");
    params.push(new Date().toISOString());

    // Add WHERE clause parameter
    params.push(id);

    const sql = `
      UPDATE ${this.tableName} 
      SET ${setClause.join(", ")} 
      WHERE id = ?
    `;

    const result = await this.db.execute(sql, params);
    return result.affectedRows > 0;
  }

  async delete(id: string): Promise<boolean> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const result = await this.db.execute(sql, [id]);
    return result.affectedRows > 0;
  }

  async bulkUpdateStatus(ids: string[], status: string): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const sql = `
      UPDATE ${this.tableName} 
      SET status = ?, updated_at = ?
      WHERE id IN (${placeholders})
    `;

    const params = [status, new Date().toISOString(), ...ids];
    const result = await this.db.execute(sql, params);
    return result.affectedRows;
  }

  async getCategories(): Promise<string[]> {
    const sql = `SELECT DISTINCT category FROM ${this.tableName} ORDER BY category`;
    const results = await this.db.query<{ category: string }>(sql);
    return results.map((row) => row.category);
  }

  async getStatuses(): Promise<string[]> {
    const sql = `SELECT DISTINCT status FROM ${this.tableName} ORDER BY status`;
    const results = await this.db.query<{ status: string }>(sql);
    return results.map((row) => row.status);
  }

  async getCount(filter: CredentialFilter = {}): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: any[] = [];
    const conditions: string[] = [];

    // Apply same filters as findAll
    if (filter.category) {
      conditions.push("category = ?");
      params.push(filter.category);
    }

    if (filter.status) {
      conditions.push("status = ?");
      params.push(filter.status);
    }

    if (filter.importance !== undefined) {
      conditions.push("importance = ?");
      params.push(filter.importance);
    }

    if (filter.search) {
      conditions.push("(login LIKE ? OR url LIKE ? OR tags LIKE ?)");
      const searchPattern = `%${filter.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    const results = await this.db.query<{ count: number }>(sql, params);
    return results[0]?.count || 0;
  }

  private mapRowToCredential(row: any): CredentialData {
    return {
      id: row.id,
      login: row.login,
      password: row.password,
      url: row.url,
      category: row.category,
      importance: row.importance,
      status: row.status,
      changePasswordUrl: row.change_password_url,
      screenshot: row.screenshot,
      tags: JSON.parse(row.tags || "[]"),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
