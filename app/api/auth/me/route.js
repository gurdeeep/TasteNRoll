import { NextResponse } from "next/server";
import { getSession } from "../../../lib/auth";

// Lets the browser learn who it is without ever reading the cookie itself:
// the session cookie is httpOnly and invisible to page JS by design.
export async function GET() {
  const [owner, customer] = await Promise.all([
    getSession("owner"),
    getSession("customer"),
  ]);

  return NextResponse.json({
    owner: owner ? { username: owner.sub } : null,
    customer: customer
      ? { id: customer.sub, name: customer.name, phone: customer.phone }
      : null,
  });
}
