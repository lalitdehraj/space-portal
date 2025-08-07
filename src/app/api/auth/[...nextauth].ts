import NextAuth from "next-auth";
import AzureAD from "next-auth/providers/azure-ad";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    AzureAD({
      clientId: process.env.AUTH_AZURE_AD_CLIENT_ID as string,
      clientSecret: process.env.AUTH_AZURE_AD_CLIENT_SECRET as string,
      tenantId: process.env.AUTH_AZURE_AD_TENANT_ID, // Optional: If you want to restrict to a specific tenant
    }),
  ],
  // Optional: Add callbacks for more control over session and JWT
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Persist the OAuth access_token and or the user id to the JWT
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token; // Azure AD often provides an ID Token
      }
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      return session;
    },
  },
  // Optional: Configure pages for custom login/error pages
  pages: {
    signIn: "/login",
  },
  // Ensure the secret is set for production
  secret: process.env.AUTH_SECRET,
});
