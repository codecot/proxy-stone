import { TableSchema } from "../../../database/types.js";

export const CREDENTIALS_SCHEMA: TableSchema = {
  columns: [
    {
      name: "id",
      type: "TEXT",
      primaryKey: true,
      notNull: true,
    },
    {
      name: "login",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "password",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "url",
      type: "TEXT",
      notNull: true,
    },
    {
      name: "category",
      type: "TEXT",
      notNull: true,
      defaultValue: "uncategorized",
    },
    {
      name: "importance",
      type: "INTEGER",
      notNull: true,
      defaultValue: 3,
    },
    {
      name: "status",
      type: "TEXT",
      notNull: true,
      defaultValue: "pending",
    },
    {
      name: "change_password_url",
      type: "TEXT",
      notNull: false,
    },
    {
      name: "screenshot",
      type: "TEXT",
      notNull: false,
    },
    {
      name: "tags",
      type: "TEXT",
      notNull: true,
      defaultValue: "[]",
    },
    {
      name: "created_at",
      type: "DATETIME",
      notNull: true,
    },
    {
      name: "updated_at",
      type: "DATETIME",
      notNull: true,
    },
  ],
  indexes: [
    {
      name: "idx_credentials_login",
      columns: ["login"],
      unique: false,
    },
    {
      name: "idx_credentials_category",
      columns: ["category"],
      unique: false,
    },
    {
      name: "idx_credentials_status",
      columns: ["status"],
      unique: false,
    },
    {
      name: "idx_credentials_importance",
      columns: ["importance"],
      unique: false,
    },
    {
      name: "idx_credentials_created_at",
      columns: ["created_at"],
      unique: false,
    },
  ],
};
