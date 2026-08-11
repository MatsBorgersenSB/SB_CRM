import { NextResponse } from "next/server";
import type { M365Payload } from "@/types/m365";

export function m365Json(payload: M365Payload, status = 200) {
  return NextResponse.json(payload, { status });
}

export function m365Error(
  message: string,
  status: 400 | 401 | 403 | 404 | 500,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}
