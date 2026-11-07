"use client";

import { useCallback, useEffect, useState } from "react";

type FreeRoom = {
  id: string;
  number: string;
  category: string;
  pricePerNight: number;
  nights: number;
  totalPrice: number;
};
type BookingRow = {
  id: string;
  roomNumber: string;
  guestName: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  status: "confirmed" | "cancelled";
};

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function Page() {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [category, setCategory] = useState("");
  const [rooms, setRooms] = useState<FreeRoom[] | null>(null);
  const [searched, setSearched] = useState<{ ci: string; co: string } | null>(
    null,
  );
  const [selected, setSelected] = useState<FreeRoom | null>(null);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookings, setBookings] = useState<BookingRow[]>([]);

  const loadBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setBookings(data.bookings);
    } catch {
      /* list is secondary; ignore */
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  async function search(ci = checkIn, co = checkOut) {
    setError("");
    setSelected(null);
    if (!ci || !co) {
      setError("Please pick check-in and check-out dates");
      return;
    }
    if (co <= ci) {
      setError("Check-out must be after check-in");
      setRooms(null);
      return;
    }
    setBusy(true);
    try {
      const qs = new URLSearchParams({ checkIn: ci, checkOut: co });
      if (category) qs.set("category", category);
      const res = await fetch("/api/availability?" + qs, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Search failed");
        setRooms(null);
        return;
      }
      setRooms(data.rooms);
      setSearched({ ci, co });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCheckIn("");
    setCheckOut("");
    setCategory("");
    setRooms(null);
    setSearched(null);
    setSelected(null);
    setGuestName("");
    setPhone("");
    setError("");
    setSuccess("");
  }

  async function book() {
    if (!selected || !searched) return;
    setError("");
    setSuccess("");
    if (!guestName.trim()) {
      setError("Guest name is required");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      setError("Phone must be exactly 10 digits");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selected.id,
          guestName,
          phone,
          checkIn: searched.ci,
          checkOut: searched.co,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Booking failed");
        // e.g. 409: someone else took the room -> refresh the free list
        if (res.status === 409) await search(searched.ci, searched.co);
        return;
      }
      setSuccess(
        `Booked room ${selected.number} for ${data.guestName}: ${data.checkIn} to ${data.checkOut} (${data.nights} night${data.nights > 1 ? "s" : ""}), total ${inr(data.totalPrice)}.`,
      );
      setGuestName("");
      setPhone("");
      setSelected(null);
      await search(searched.ci, searched.co);
      await loadBookings();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this booking?")) return;
    setError("");
    setSuccess("");
    const res = await fetch(`/api/bookings/${id}`, { method: "PATCH" });
    if (!res.ok) {
      setError((await res.json()).error || "Cancel failed");
      return;
    }
    setSuccess("Booking cancelled.");
    await loadBookings();
    if (searched) await search(searched.ci, searched.co);
  }

  return (
    <main>
      <h1>Nimba Stay</h1>
      <p className="sub">Nimba Nature Cure — front desk</p>

      <h2>1. Find free rooms</h2>
      <div className="row">
        <label>
          Check-in
          <input
            type="date"
            value={checkIn}
            min={todayStr()}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </label>
        <label>
          Check-out
          <input
            type="date"
            value={checkOut}
            min={checkIn || todayStr()}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </label>
        <label>
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All</option>
            <option>Standard</option>
            <option>Deluxe</option>
            <option>Suite</option>
          </select>
        </label>
        <button onClick={() => search()} disabled={busy}>
          Search
        </button>
        <button onClick={reset} disabled={busy}>
          Reset
        </button>
      </div>

      {error && (
        <div className="err" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="ok" role="status">
          {success}
        </div>
      )}

      {rooms && (
        <>
          {rooms.length === 0 ? (
            <p>No rooms free for these dates.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Category</th>
                  <th>Per night</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id} className={selected?.id === r.id ? "sel" : ""}>
                    <td>{r.number}</td>
                    <td>{r.category}</td>
                    <td>{inr(r.pricePerNight)}</td>
                    <td>
                      {inr(r.totalPrice)}{" "}
                      <span className="muted">
                        ({r.nights} night{r.nights > 1 ? "s" : ""})
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setSelected(r);
                          setSuccess("");
                          setError("");
                        }}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {selected && (
        <>
          <h2>2. Guest details — Room {selected.number}</h2>
          <div className="row">
            <label>
              Guest name
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </label>
            <label>
              Phone (10 digits)
              <input
                value={phone}
                inputMode="numeric"
                maxLength={10}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button onClick={book} disabled={busy}>
              Book — {inr(selected.totalPrice)}
            </button>
          </div>
        </>
      )}

      <h2>Bookings</h2>
      {bookings.length === 0 ? (
        <p className="muted">No bookings yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Guest</th>
              <th>Phone</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Total</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{b.roomNumber}</td>
                <td>{b.guestName}</td>
                <td>{b.phone}</td>
                <td>{b.checkIn}</td>
                <td>{b.checkOut}</td>
                <td>{inr(b.totalPrice)}</td>
                <td>{b.status}</td>
                <td>
                  <button onClick={() => cancel(b.id)}>Cancel</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
