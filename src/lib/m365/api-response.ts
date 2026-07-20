import { NextResponse } from "next/server";
import type { M365Payload } from "@/types/m365";

export function m365Json(payload: M365Payload, status = 200) {
  return NextResponse.json(payload, { status });
}

export function m365Error(message: string, status: 400 | 404 | 500) {
  return NextResponse.json({ error: message }, { status });
}
