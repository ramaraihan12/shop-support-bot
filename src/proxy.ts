import { NextResponse, type NextRequest } from "next/server";
import { adminAccess } from "@/lib/admin/access";

export function proxy(request: NextRequest) {
  const access = adminAccess(request.headers.get("authorization"));
  if (access === "granted") return NextResponse.next();
  if (access === "disabled") return new NextResponse("Not found", { status: 404 });

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Kopi Nusantara admin", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
