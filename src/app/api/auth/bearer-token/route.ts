import { NextResponse } from "next/server";

export type BearerTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export async function POST() {
  try {
    const params = new URLSearchParams();
    params.append("client_id", process.env.NEXT_PUBLIC_CLIENT_ID || "");
    params.append("client_secret", process.env.NEXT_PUBLIC_CLIENT_SECRET || "");
    params.append("scope", process.env.NEXT_PUBLIC_SCOPE || "");
    params.append("grant_type", process.env.NEXT_PUBLIC_GRANT_TYPE || "client_credentials");
    params.append("token_name", process.env.NEXT_PUBLIC_TOKEN_NAME || "");

    const tenantId = process.env.NEXT_PUBLIC_TENANT_ID;
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    console.log("Bearer token request URL:", tokenUrl);
    console.log("Environment variables check:", {
      hasClientId: !!process.env.NEXT_PUBLIC_CLIENT_ID,
      hasClientSecret: !!process.env.NEXT_PUBLIC_CLIENT_SECRET,
      hasScope: !!process.env.NEXT_PUBLIC_SCOPE,
      hasTenantId: !!tenantId,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Error response from token endpoint:", errorData);
      return NextResponse.json({ success: false, error: "Failed to fetch bearer token" }, { status: response.status });
    }

    const data: BearerTokenResponse = await response.json();
    console.log("Access_token in response:", data);

    if (data.access_token) {
      const expiryTime = Date.now() + data.expires_in * 1000 - 2 * 60 * 1000; // Subtract 2 minutes
      return NextResponse.json({
        success: true,
        token: data.access_token,
        expiry: expiryTime,
      });
    }

    return NextResponse.json({ success: false, error: "No access token in response" }, { status: 500 });
  } catch (error) {
    console.error("Error generating bearer token:", error);
    return NextResponse.json({ success: false, error: "Internal server error while fetching token" }, { status: 500 });
  }
}
