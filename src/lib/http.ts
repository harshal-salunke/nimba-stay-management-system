import { NextResponse } from "next/server";
import { HttpError } from "./types";

export function handle(fn: () => unknown, okStatus = 200) {
  try {
    return NextResponse.json(fn(), { status: okStatus });
  } catch (e) {
    if (e instanceof HttpError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
