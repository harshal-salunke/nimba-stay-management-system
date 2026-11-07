import { randomUUID } from "crypto";
import { nightsBetween, parseDate } from "./dates";
import { readDb, transaction } from "./store";
import { Booking, CATEGORIES, Category, Db, HttpError, Room } from "./types";

export interface FreeRoom extends Room {
  nights: number;
  totalPrice: number;
}

function parseStay(checkIn: unknown, checkOut: unknown) {
  const ci = parseDate(checkIn);
  const co = parseDate(checkOut);
  if (ci === null)
    throw new HttpError(400, "checkIn must be a valid date (YYYY-MM-DD)");
  if (co === null)
    throw new HttpError(400, "checkOut must be a valid date (YYYY-MM-DD)");
  if (co <= ci) throw new HttpError(400, "Check-out must be after check-in");
  return { ci, co, nights: nightsBetween(ci, co) };
}

/**
 * Stays are half-open [checkIn, checkOut): the checkOut day is not a night stayed.
 * Two stays clash only if each starts before the other ends. So a guest leaving
 * on 20 Nov (checkOut = 20) does NOT clash with a guest arriving on 20 Nov.
 * Cancelled bookings are ignored.
 */
export function hasClash(
  db: Db,
  roomId: string,
  ci: number,
  co: number,
): boolean {
  return db.bookings.some((b) => {
    if (b.roomId !== roomId || b.status === "cancelled") return false;
    const bi = parseDate(b.checkIn)!;
    const bo = parseDate(b.checkOut)!;
    return bi < co && ci < bo;
  });
}

export function findAvailability(
  checkIn: unknown,
  checkOut: unknown,
  category?: string | null,
): FreeRoom[] {
  const { ci, co, nights } = parseStay(checkIn, checkOut);
  if (category && !CATEGORIES.includes(category as Category)) {
    throw new HttpError(
      400,
      `category must be one of: ${CATEGORIES.join(", ")}`,
    );
  }
  const db = readDb();
  return db.rooms
    .filter((r) => r.status !== "maintenance")
    .filter((r) => !category || r.category === category)
    .filter((r) => !hasClash(db, r.id, ci, co))
    .map((r) => ({ ...r, nights, totalPrice: nights * r.pricePerNight }));
}

export interface BookingInput {
  roomId?: unknown;
  guestName?: unknown;
  phone?: unknown;
  checkIn?: unknown;
  checkOut?: unknown;
}

export function createBooking(input: BookingInput): Booking {
  const { ci, co, nights } = parseStay(input.checkIn, input.checkOut);
  const guestName =
    typeof input.guestName === "string" ? input.guestName.trim() : "";
  if (!guestName) throw new HttpError(400, "Guest name is required");
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  if (!/^\d{10}$/.test(phone))
    throw new HttpError(400, "Phone must be exactly 10 digits");
  if (typeof input.roomId !== "string" || !input.roomId)
    throw new HttpError(400, "roomId is required");
  const roomId = input.roomId;

  return transaction((db) => {
    const room = db.rooms.find((r) => r.id === roomId);
    if (!room) throw new HttpError(404, "Room not found");
    if (room.status === "maintenance")
      throw new HttpError(409, "Room is under maintenance");
    if (hasClash(db, roomId, ci, co)) {
      throw new HttpError(
        409,
        "Room is already booked for some of these nights",
      );
    }
    const booking: Booking = {
      id: randomUUID(),
      roomId,
      guestName,
      phone,
      checkIn: input.checkIn as string,
      checkOut: input.checkOut as string,
      nights,
      totalPrice: nights * room.pricePerNight,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
    db.bookings.push(booking);
    return booking;
  });
}

export function listBookings() {
  const db = readDb();
  return db.bookings
    .filter((b) => b.status !== "cancelled") // cancelled bookings are hidden from the desk list
    .map((b) => ({
      ...b,
      roomNumber: db.rooms.find((r) => r.id === b.roomId)?.number ?? "?",
    }))
    .sort((a, b) =>
      a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0,
    );
}

export function cancelBooking(id: string): Booking {
  return transaction((db) => {
    const b = db.bookings.find((x) => x.id === id);
    if (!b) throw new HttpError(404, "Booking not found");
    b.status = "cancelled";
    return b;
  });
}
