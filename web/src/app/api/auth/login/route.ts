import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/auth";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  try { if (origin && new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }
  } catch { return NextResponse.json({error:"Request not allowed."},{status:403}); }
  let body: { username?: unknown; password?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Enter your username and password." }, { status: 400 }); }
  if (typeof body?.username !== "string" || typeof body?.password !== "string") {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  }
  if (!["owner", "staff"].includes(body.username.trim()) || body.password !== "123") {
    return NextResponse.json({ error: "Username or password is incorrect." }, { status: 401 });
  }
  try {
    const response = NextResponse.json({ ok: true });
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(SESSION_COOKIE, createSession(body.username.trim() as "owner" | "staff"), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Sign-in is unavailable. Please try again later." }, { status: 503 });
  }
}
