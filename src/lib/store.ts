import fs from "fs";
import path from "path";
import { Db, Room } from "./types";

function dataFile(): string {
  return process.env.NIMBA_DATA_FILE || path.join(process.cwd(), "data", "db.json");
}

function seedRooms(): Room[] {
  return [
    { id: "r101", number: "101", category: "Standard", pricePerNight: 2500, status: "available" },
    { id: "r102", number: "102", category: "Standard", pricePerNight: 2500, status: "available" },
    { id: "r103", number: "103", category: "Standard", pricePerNight: 2500, status: "maintenance" },
    { id: "r201", number: "201", category: "Deluxe", pricePerNight: 4000, status: "available" },
    { id: "r202", number: "202", category: "Deluxe", pricePerNight: 4000, status: "available" },
    { id: "r203", number: "203", category: "Deluxe", pricePerNight: 4200, status: "available" },
    { id: "r301", number: "301", category: "Suite", pricePerNight: 6500, status: "available" },
    { id: "r302", number: "302", category: "Suite", pricePerNight: 7000, status: "available" },
  ];
}

export function writeDb(db: Db): void {
  const f = dataFile();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, f); // atomic replace: file is never half-written
}

export function readDb(): Db {
  const f = dataFile();
  if (!fs.existsSync(f)) writeDb({ rooms: seedRooms(), bookings: [] });
  return JSON.parse(fs.readFileSync(f, "utf8")) as Db;
}

/**
 * Read -> check -> write in ONE synchronous block (no await in between), so two
 * requests can never interleave and double-book. If fn throws, nothing is written.
 */
export function transaction<T>(fn: (db: Db) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}
