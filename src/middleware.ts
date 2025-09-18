import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { callApi } from "./utils/apiIntercepter";
import { UserProfile } from "./types";
import { URL_NOT_FOUND } from "./constants";
// import { authOptions } from './app/api/auth/[...nextauth]/authOptions';


const PUBLIC_PATHS = ["/api/auth", "/login"];
const PUBLIC_FILE = /\.(.*)$/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const userRoles = new Set<string>();
  // const session = await getServerSession(authOptions);

  const fetchUser = async (email: string | null) => {
    if (!email) return;
    try {
      const response = await callApi<UserProfile[]>(process.env.NEXT_PUBLIC_GET_USER || URL_NOT_FOUND);
      if (response.success) {
        response.data?.forEach((user) => {
          if (!userRoles.has(user.userRole)) userRoles.add(user.userRole.replace(" ", "%20"));
        });
      }
      console.log("response::", response);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path)) || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }

  // // If there's no session, redirect to the login page
  // if (!session) {
  //   const url = req.nextUrl.clone();
  //   url.pathname = "/login";
  //   return NextResponse.redirect(url);
  // }

  fetchUser(null);

  const hasAccess = Array.from(userRoles).some((role) => pathname.includes(role));
  console.log("hasAccess::", hasAccess);

  // if (hasAccess) return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
