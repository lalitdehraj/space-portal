import { NextRequest, NextResponse } from "next/server";
import { Building } from "@/types";

export function POST(request: NextRequest) {
  const f = async () => {
    const url =
      "http://172.17.112.21:2445/MUJERP/api/MUJ/MUJAPIGroup/v2.0/companies(480ceadc-3108-f011-8e30-7c1e520f486f)/MUJ(00000000-0000-0000-0000-000000000000)/Microsoft.NAV.GetBuildingData";
    const credentials = btoa(
      `${"IG_Admin4"}:${"nN,^@Z}q/I3a!t;*ITL:sxw(o0#E<H"}`
    );
    const reqBody = {
      acadSession: "JUL-NOV 2024",
      acadYear: "24-25",
    };
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify(reqBody),
    });

    const finalData = await getCleanedData(response);
    console.log("Logger: ", finalData);
  };
  f();
  return new NextResponse();
}

async function getCleanedData(response: Response) {
  try {
    const rawDataString = await response.text();
    const parsedObject = JSON.parse(rawDataString);
    let messyJsonString = parsedObject.value;
    const cleanJsonString = messyJsonString
      .replace(/\\r\\n/g, "")
      .replace(/\u00A0/g, "")
      .trim();
    const finalData = JSON.parse(cleanJsonString);
    return finalData;
  } catch (error) {
    console.error("Failed to clean and parse data:", error);
  }
}
