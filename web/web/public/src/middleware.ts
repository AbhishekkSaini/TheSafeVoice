import { NextResponse } from "next/server";

export function middleware() {
  // Example: protect composer pages if needed in future
  return NextResponse.next();
}

export const config = {
  matcher: ["/thread/new"],
};


