import { NextResponse } from "next/server";
import { handle } from "../../../lib/http";
import { createBooking, listBookings } from "../../../lib/service";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => ({ bookings: listBookings() }));
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be valid JSON" },
      { status: 400 },
    );
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Body must be a JSON object" },
      { status: 400 },
    );
  }
  return handle(() => createBooking(body as Record<string, unknown>), 201);
}
