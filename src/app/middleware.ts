// import { auth } from "./api/auth/[...nextauth]";

// export default auth((req:any) => {
//   // Example: Protect all routes except / (home)
//   // If the user is not authenticated and tries to access a protected route,
//   // they will be redirected to the sign-in page.
//   const publicRoutes = ["/"]; // Define routes that don't require authentication

//   const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname === route);

//   if (!req.auth && !isPublicRoute) {
//     // Redirect to the sign-in page if not authenticated and not a public route
//     const signInUrl = new URL("/api/auth/signin", req.url);
//     signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
//     return Response.redirect(signInUrl);
//   }
// });

// // Configure the matcher to apply middleware to specific paths
// export const config = {
//   matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
// };