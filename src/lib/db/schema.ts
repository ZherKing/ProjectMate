import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  school: text("school"),
  education: text("education"),
  roles: text("roles"),
  skills: text("skills"),
  interests: text("interests"),
  weeklyHours: integer("weekly_hours"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const competitions = sqliteTable("competitions", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(),
  name: text("name").notNull(),
  season: text("season"),
  status: text("status").notNull(),
  sourceUrl: text("source_url").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const competitionTracks = sqliteTable("competition_tracks", {
  id: text("id").primaryKey(),
  competitionId: text("competition_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  deadline: integer("deadline", { mode: "timestamp" }),
});
