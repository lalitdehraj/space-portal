import { PrismaClient } from "@/generated/prisma";
import { AcademicSessions } from "@/types";
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();


// export async function GET() {
//     const buildings = await prisma.mUJ_Block_List_440cc58b_ca34_4916_ba94_a0a77cae7c26.findMany()

  
//   return NextResponse.json(buildings);
// }


export async function GET(request:NextRequest) {

  const response = NextResponse.json

  console.log(`Lalit  ${request.url === process.env.NEXT_PUBLIC_GET_ACADMIC_CALENDER}   ${request.url} == ${process.env.NEXT_PUBLIC_GET_ACADMIC_CALENDER}`)

  if (request.url === `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_GET_ACADMIC_CALENDER}`)
    return response(AcademicCalender)
  else 
    return response({error:"return from end"})
}
const AcademicCalender:AcademicSessions = {
  academicSessions:["Jan - Mar","Apr - Jun","Jul - Sept", "Oct - Dec"],
  academicYears:[2021,2022,2023,2024,2025,2026]
}