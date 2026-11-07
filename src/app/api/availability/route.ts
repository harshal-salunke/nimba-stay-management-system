import { handle } from "../../../lib/http";
import { findAvailability } from "../../../lib/service";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  return handle(() => ({
    rooms: findAvailability(p.get("checkIn"), p.get("checkOut"), p.get("category") || null),
  }));
}
