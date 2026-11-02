import { sqlite } from "./client";
import { initializeDatabase } from "./initialize";

export type UserProfile = {
  userId: string;
  school: string | null;
  education: string | null;
  roles: string | null;
  skills: string | null;
  interests: string | null;
  weeklyHours: number | null;
};

export function getProfile(userId: string) {
  initializeDatabase();
  return sqlite.prepare(
    "SELECT user_id AS userId, school, education, roles, skills, interests, weekly_hours AS weeklyHours FROM profiles WHERE user_id = ?",
  ).get(userId) as UserProfile | undefined;
}

export function saveProfile(userId: string, input: Omit<UserProfile, "userId">) {
  initializeDatabase();
  sqlite.prepare(
    "INSERT INTO profiles (user_id, school, education, roles, skills, interests, weekly_hours, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET school=excluded.school, education=excluded.education, roles=excluded.roles, skills=excluded.skills, interests=excluded.interests, weekly_hours=excluded.weekly_hours, updated_at=excluded.updated_at",
  ).run(userId, input.school, input.education, input.roles, input.skills, input.interests, input.weeklyHours, Date.now());
}
