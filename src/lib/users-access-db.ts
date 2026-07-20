import { promises as fs } from "fs";
import path from "path";
import type {
  CreateUserInput,
  StandardBioUserRecord,
  UpdateUserInput,
} from "@/types/user-access";

const DB_PATH = path.join(process.cwd(), "src/data/users-access.json");

type UsersAccessDatabase = {
  users: StandardBioUserRecord[];
};

async function readDb(): Promise<UsersAccessDatabase> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as UsersAccessDatabase;
    if (!Array.isArray(parsed.users)) {
      return { users: [] };
    }
    return parsed;
  } catch {
    return { users: [] };
  }
}

async function writeDb(database: UsersAccessDatabase): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(database, null, 2), "utf-8");
}

function nextUserId(users: StandardBioUserRecord[]): number {
  const maxId = users.reduce((max, user) => Math.max(max, user.id), 0);
  return maxId >= 100 ? maxId + 1 : Math.max(maxId + 1, 100);
}

function nextUserCode(users: StandardBioUserRecord[]): string {
  const maxSeq = users.reduce((max, user) => {
    const match = user.userId.match(/SB-USER-(\d+)/);
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
  }, 0);
  return `SB-USER-${String(maxSeq + 1).padStart(3, "0")}`;
}

export async function readUsers(): Promise<StandardBioUserRecord[]> {
  const db = await readDb();
  return db.users.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function readUserById(id: number): Promise<StandardBioUserRecord | null> {
  const db = await readDb();
  return db.users.find((user) => user.id === id) ?? null;
}

export async function createUser(input: CreateUserInput): Promise<StandardBioUserRecord> {
  const db = await readDb();
  const now = new Date().toISOString();
  const id = nextUserId(db.users);

  const record: StandardBioUserRecord = {
    id,
    userId: nextUserCode(db.users),
    displayName: input.displayName.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role ?? null,
    businessFunction: input.businessFunction ?? null,
    team: input.team ?? "Commercial",
    license: input.license ?? "SmartCRM Standard",
    status: "active",
    ownershipScope: input.ownershipScope ?? "none",
    ownedCompanyIds: input.ownedCompanyIds ?? [],
    lastActiveAt: now,
    createdAt: now,
  };

  db.users.push(record);
  await writeDb(db);
  return record;
}

export async function updateUser(
  id: number,
  patch: UpdateUserInput,
): Promise<StandardBioUserRecord | null> {
  const db = await readDb();
  const index = db.users.findIndex((user) => user.id === id);
  if (index === -1) return null;

  const current = db.users[index];
  const updated: StandardBioUserRecord = {
    ...current,
    ...patch,
    displayName: patch.displayName?.trim() ?? current.displayName,
    email: patch.email?.trim().toLowerCase() ?? current.email,
  };

  db.users[index] = updated;
  await writeDb(db);
  return updated;
}

export async function disableUser(id: number): Promise<StandardBioUserRecord | null> {
  return updateUser(id, { status: "disabled" });
}

export async function archiveUser(id: number): Promise<StandardBioUserRecord | null> {
  return updateUser(id, { status: "archived" });
}

export async function deleteUser(id: number): Promise<boolean> {
  const db = await readDb();
  const before = db.users.length;
  db.users = db.users.filter((user) => user.id !== id);
  if (db.users.length === before) return false;
  await writeDb(db);
  return true;
}

export function userToSharePointPerson(user: StandardBioUserRecord): { Id: number; Title: string } {
  return { Id: user.id, Title: user.displayName };
}

export async function readActiveAssignableUsers(): Promise<StandardBioUserRecord[]> {
  const users = await readUsers();
  return users.filter((user) => user.status === "active");
}
