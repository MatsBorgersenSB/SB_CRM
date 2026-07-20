import { NextResponse } from "next/server";
import { createUser, readUsers } from "@/lib/users-access-db";
import type { CreateUserInput } from "@/types/user-access";

export async function GET() {
  const users = await readUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  let body: CreateUserInput;
  try {
    body = (await request.json()) as CreateUserInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.displayName?.trim() || !body.email?.trim()) {
    return NextResponse.json(
      { error: "displayName and email are required" },
      { status: 400 },
    );
  }

  const user = await createUser(body);
  return NextResponse.json({ user }, { status: 201 });
}
