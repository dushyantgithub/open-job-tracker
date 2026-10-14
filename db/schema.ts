import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const jobs = sqliteTable("jobs", { id: text("id").primaryKey(), company: text("company").notNull(), title: text("title").notNull(), status: text("status").notNull().default("discovered"), data: text("data").notNull(), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull() });
export const activities = sqliteTable("activities", { id: text("id").primaryKey(), type: text("type").notNull().default("info"), message: text("message").notNull(), jobId: text("job_id"), createdAt: text("created_at").notNull() });
export const requests = sqliteTable("requests", { id: text("id").primaryKey(), count: integer("count").notNull().default(25), status: text("status").notNull().default("queued"), createdAt: text("created_at").notNull(), acknowledgedAt: text("acknowledged_at"), notes: text("notes"), target: integer("target"), baseTotal: integer("base_total"), workerId: text("worker_id"), completedAt: text("completed_at") });
export const settings = sqliteTable("settings", { id: text("id").primaryKey(), data: text("data").notNull() });

export const submissionKeys = sqliteTable("submission_keys", { canonicalUrl: text("canonical_url").primaryKey(), jobId: text("job_id").notNull().unique() });
