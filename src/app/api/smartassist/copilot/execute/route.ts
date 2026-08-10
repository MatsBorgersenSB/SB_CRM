import { NextResponse } from "next/server";
import { executeCoPilotProposal } from "@/lib/smartassist-copilot-executor";
import type { CoPilotActionProposal } from "@/types/smartassist-copilot";

export async function POST(request: Request) {
  let proposal: CoPilotActionProposal;
  try {
    const body = (await request.json()) as { proposal?: CoPilotActionProposal };
    if (!body.proposal?.id || !body.proposal?.kind) {
      return NextResponse.json(
        { error: "A Co-Pilot proposal is required." },
        { status: 400 },
      );
    }
    proposal = body.proposal;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await executeCoPilotProposal(proposal);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not apply recommendation.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
