import { parse } from "csv-parse/sync";
import crypto from "crypto";

export interface CredentialData {
  id: string;
  login: string;
  password: string;
  url: string;
  category: string;
  importance: number; // 1-5 scale
  status: "pending" | "processed" | "verified" | "changed" | "archived"; // Admin status
  changePasswordUrl?: string;
  screenshot?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
  data: CredentialData[];
}

export class PasswordCSVImporter {
  async importFromCSV(csvContent: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      failed: 0,
      errors: [],
      data: [],
    };

    try {
      // Parse CSV with headers: login,password,url,category,importance
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      for (const record of records) {
        try {
          const credential = this.validateAndCreateCredential(record);
          result.data.push(credential);
          result.imported++;
        } catch (error) {
          result.failed++;
          result.errors.push(
            `Row ${result.imported + result.failed}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(
        `CSV parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }

    return result;
  }

  private parseStatus(
    status: string
  ): "pending" | "processed" | "verified" | "changed" | "archived" {
    const validStatuses = [
      "pending",
      "processed",
      "verified",
      "changed",
      "archived",
    ];
    const normalizedStatus = status?.toLowerCase().trim();
    return validStatuses.includes(normalizedStatus)
      ? (normalizedStatus as any)
      : "pending";
  }

  private validateAndCreateCredential(record: any): CredentialData {
    // Validate required fields
    if (!record.login || !record.password || !record.url) {
      throw new Error("Missing required fields: login, password, url");
    }

    // Validate URL format
    try {
      new URL(record.url);
    } catch {
      throw new Error(`Invalid URL format: ${record.url}`);
    }

    const now = new Date().toISOString();

    return {
      id: crypto.randomUUID(),
      login: record.login.trim(),
      password: record.password, // Keep original password
      url: record.url.trim(),
      category: record.category?.trim() || "uncategorized",
      importance: this.parseImportance(record.importance),
      status: this.parseStatus(record.status),
      changePasswordUrl: record.changePasswordUrl?.trim(),
      screenshot: undefined,
      createdAt: now,
      updatedAt: now,
      tags: record.tags
        ? record.tags.split(",").map((t: string) => t.trim())
        : [],
    };
  }

  private parseImportance(importance: any): number {
    const parsed = parseInt(importance) || 3;
    return Math.max(1, Math.min(5, parsed)); // Clamp between 1-5
  }

  // Generate sample CSV template
  generateTemplate(): string {
    return `login,password,url,category,importance,tags,status
admin@example.com,secret123,https://example.com,work,5,"admin,important",pending
user@test.com,password456,https://test.com,personal,3,"social",pending
support@company.com,secure789,https://company.com,work,4,"support,business",processed`;
  }
}
