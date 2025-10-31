import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    
    // Always allow access to sign-up and sign-in pages - let them handle their own logic
    if (["/sign-in", "/sign-up"].includes(pathname)) {
      return NextResponse.next();
    }

    // Check for session cookie - Better Auth uses "better-auth.session_token" by default
    let hasSession = false;
    try {
      // Try the Better Auth helper first
      const sessionCookie = getSessionCookie(request);
      hasSession = !!sessionCookie;
    } catch (error) {
      // Fallback: check for Better Auth cookie directly
      const cookies = request.cookies;
      // Check common Better Auth cookie names
      hasSession = cookies.has("better-auth.session_token") || 
                   cookies.has("better-auth.session");
    }

    // For dashboard routes: redirect unauthenticated users to sign-up
    if (pathname.startsWith("/dashboard")) {
      if (!hasSession) {
        const signUpUrl = new URL("/sign-up", request.url);
        // Preserve the original path as a redirect parameter if needed
        if (pathname !== "/dashboard") {
          signUpUrl.searchParams.set("redirect", pathname);
        }
        return NextResponse.redirect(signUpUrl);
      }
    }

    return NextResponse.next();
  } catch (error) {
    // If there's an error, allow access to auth pages but redirect dashboard to sign-up
    const { pathname } = request.nextUrl;
    if (pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/sign-up", request.url));
    }
    // Allow other pages to continue
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
};
