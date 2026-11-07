import { handle } from "../../../../lib/http";
import { cancelBooking } from "../../../../lib/service";

export const dynamic = "force-dynamic";

// PATCH /api/bookings/:id  -> cancels the booking
export function PATCH(_req: Request, { params }: { params: { id: string } }) {
  return handle(() => cancelBooking(params.id));
}
