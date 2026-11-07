import fs from "fs";
import path from "path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cancelBooking, createBooking, findAvailability } from "../src/lib/service";
import { readDb, writeDb } from "../src/lib/store";
import { HttpError } from "../src/lib/types";

const dir = path.join(process.cwd(), ".tmp-test");
process.env.NIMBA_DATA_FILE = path.join(dir, "db.json");

const guest = { guestName: "Asha", phone: "9876543210" };
const book = (roomId: string, checkIn: string, checkOut: string, extra = {}) =>
  createBooking({ roomId, checkIn, checkOut, ...guest, ...extra });
const status = (fn: () => unknown) => {
  try { fn(); return 200; } catch (e) { return (e as HttpError).status ?? 500; }
};
const freeIds = (ci: string, co: string, cat?: string) => findAvailability(ci, co, cat).map((r) => r.id);

beforeEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  readDb(); // creates fresh seed
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("clash rules", () => {
  it("guest leaving on 20 Nov does not block a guest arriving on 20 Nov", () => {
    book("r101", "2026-11-18", "2026-11-20");
    expect(freeIds("2026-11-20", "2026-11-22")).toContain("r101");
    expect(status(() => book("r101", "2026-11-20", "2026-11-22"))).toBe(200);
  });

  it("new guest leaving on the day an existing guest arrives is allowed", () => {
    book("r101", "2026-11-20", "2026-11-22");
    expect(status(() => book("r101", "2026-11-18", "2026-11-20"))).toBe(200);
  });

  it("overlapping stay returns 409 (partial, contained, containing, identical)", () => {
    book("r101", "2026-11-10", "2026-11-15");
    expect(status(() => book("r101", "2026-11-14", "2026-11-17"))).toBe(409); // tail overlap
    expect(status(() => book("r101", "2026-11-08", "2026-11-11"))).toBe(409); // head overlap
    expect(status(() => book("r101", "2026-11-11", "2026-11-13"))).toBe(409); // inside
    expect(status(() => book("r101", "2026-11-01", "2026-11-30"))).toBe(409); // around
    expect(status(() => book("r101", "2026-11-10", "2026-11-15"))).toBe(409); // identical
  });

  it("booked room is not listed as free for overlapping dates, other rooms are", () => {
    book("r101", "2026-11-10", "2026-11-15");
    const ids = freeIds("2026-11-12", "2026-11-13", "Standard");
    expect(ids).not.toContain("r101");
    expect(ids).toContain("r102");
  });

  it("cancelled bookings block nothing", () => {
    const b = book("r101", "2026-11-10", "2026-11-15");
    cancelBooking(b.id);
    expect(freeIds("2026-11-11", "2026-11-12")).toContain("r101");
    expect(status(() => book("r101", "2026-11-11", "2026-11-13"))).toBe(200);
  });

  it("maintenance rooms are never free and cannot be booked", () => {
    expect(freeIds("2026-12-01", "2026-12-02")).not.toContain("r103");
    expect(status(() => book("r103", "2026-12-01", "2026-12-02"))).toBe(409);
  });

  it("two bookings for the same room/night: only one succeeds", () => {
    expect(status(() => book("r201", "2026-12-05", "2026-12-07"))).toBe(200);
    expect(status(() => book("r201", "2026-12-06", "2026-12-08"))).toBe(409);
    expect(readDb().bookings.filter((b) => b.status === "confirmed")).toHaveLength(1);
  });
});

describe("validation", () => {
  it("check-out not after check-in -> 400", () => {
    expect(status(() => book("r101", "2026-11-20", "2026-11-20"))).toBe(400);
    expect(status(() => book("r101", "2026-11-20", "2026-11-19"))).toBe(400);
    expect(status(() => findAvailability("2026-11-20", "2026-11-19"))).toBe(400);
  });

  it("phone must be exactly 10 digits -> 400", () => {
    for (const phone of ["12345", "12345678901", "98765abcde", "", "98765 43210"]) {
      expect(status(() => book("r101", "2026-11-10", "2026-11-12", { phone }))).toBe(400);
    }
    expect(readDb().bookings).toHaveLength(0);
  });

  it("bad dates, missing name, unknown category -> 400; unknown room -> 404", () => {
    expect(status(() => book("r101", "2026-02-30", "2026-03-02"))).toBe(400);
    expect(status(() => book("r101", "nope", "2026-03-02"))).toBe(400);
    expect(status(() => book("r101", "2026-11-10", "2026-11-12", { guestName: "  " }))).toBe(400);
    expect(status(() => findAvailability("2026-11-10", "2026-11-12", "Penthouse"))).toBe(400);
    expect(status(() => book("zzz", "2026-11-10", "2026-11-12"))).toBe(404);
  });
});

describe("pricing", () => {
  it("total = nights x price per night", () => {
    const r = findAvailability("2026-11-10", "2026-11-13", "Suite").find((x) => x.id === "r301")!;
    expect(r.nights).toBe(3);
    expect(r.totalPrice).toBe(3 * 6500);
    expect(book("r301", "2026-11-10", "2026-11-13").totalPrice).toBe(19500);
  });
});

void writeDb;
