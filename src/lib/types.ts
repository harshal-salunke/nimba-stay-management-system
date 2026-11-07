export type Category = "Standard" | "Deluxe" | "Suite";
export const CATEGORIES: Category[] = ["Standard", "Deluxe", "Suite"];

export type RoomStatus = "available" | "maintenance";
export type BookingStatus = "confirmed" | "cancelled";

export interface Room {
  id: string;
  number: string;
  category: Category;
  pricePerNight: number;
  status: RoomStatus;
}

export interface Booking {
  id: string;
  roomId: string;
  guestName: string;
  phone: string;
  checkIn: string; // YYYY-MM-DD (first night)
  checkOut: string; // YYYY-MM-DD (departure day, NOT a night stayed)
  nights: number;
  totalPrice: number;
  status: BookingStatus;
  createdAt: string;
}

export interface Db {
  rooms: Room[];
  bookings: Booking[];
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
