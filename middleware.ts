import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // Redirect authenticated users away from auth pages
  // BUT skip this redirect if there's a redirect query param (for invitation flow)
  if (sessionCookie && ["/sign-in", "/sign-up"].includes(pathname)) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    if (redirectParam) {
      // Allow access to sign-in page if there's a redirect param
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users from protected routes to sign-in
  if (!sessionCookie && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
};
