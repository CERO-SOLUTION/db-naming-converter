import { NextResponse } from "next/server";
import { convertAbbrToKorean, convertInput, type ConvertDirection } from "@/lib/convert";
import { getDictionary } from "@/lib/dict";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body.input !== "string") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const dict = getDictionary();
    const direction = (body.direction ?? "koToAbbr") as ConvertDirection;
    const result = direction === "abbrToKo"
      ? convertAbbrToKorean(body.input, dict)
      : convertInput(body.input, dict);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
