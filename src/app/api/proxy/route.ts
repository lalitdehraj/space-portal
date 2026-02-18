import { NextRequest, NextResponse } from "next/server";
import { credentials } from "@/constants";

export async function POST(req: NextRequest) {
  try {
    let body: { endpoint?: string; requestBody?: unknown };
    try {
      const raw = await req.text();
      body = raw?.trim() ? JSON.parse(raw) : {};
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }
    const { endpoint, requestBody } = body;

    if (!endpoint) {
      return NextResponse.json({ success: false, error: "Endpoint is required" }, { status: 400 });
    }

    const baseURL = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseURL) {
      return NextResponse.json({ success: false, error: "Base URL not configured" }, { status: 500 });
    }

    // Construct the full URL
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const fullUrl = `${baseURL}${normalizedEndpoint}`;

    // All APIs are Action bound, so always use POST
    // Send empty object {} if no requestBody is provided
    const requestPayload = requestBody !== undefined && requestBody !== null ? requestBody : {};

    console.log("Proxy API call:", {
      endpoint,
      fullUrl,
      hasBody: requestBody !== undefined && requestBody !== null,
      method: "POST",
    });

    // Forward the request to the external API - always use POST for Action bound APIs
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify(requestPayload),
    });

    // Get response text first to handle both JSON and text responses
    const responseText = await response.text();

    console.log("Proxy API response:", responseText, {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `API call failed: ${response.status} - ${response.statusText}`,
          details: responseText,
        },
        { status: response.status }
      );
    }

    // Try to parse as JSON, fallback to text
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    // Handle OData response format (value property might contain JSON string)
    let parsedData = responseData;
    if (responseData && typeof responseData === "object" && responseData.value) {
      if (typeof responseData.value === "string") {
        try {
          parsedData = JSON.parse(responseData.value);
        } catch {
          parsedData = responseData.value;
        }
      } else {
        parsedData = responseData.value;
      }
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error) {
    console.error("Proxy API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
