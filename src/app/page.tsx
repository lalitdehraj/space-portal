"use client";
import { useState, useEffect } from "react";

export default function Page() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [polling, setPolling] = useState(false);

  const startJob = async () => {
    const res = await fetch("/api/start-job", {
      method: "POST",
      body: JSON.stringify({ fileKey: "AB2-data" }),
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    setJobId(data.jobId);
    setReady(false);

    if (data.alreadyExists) {
      window.open(data.downloadUrl, "_blank");
      setReady(true);
    } else {
      setPolling(true);
    }
  };

  useEffect(() => {
    console.log("console", polling, jobId);
    if (!polling || !jobId) return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/job-status?jobId=${jobId}`);
      const data = await res.json();

      if (data.ready) {
        setReady(true);
        setPolling(false);
        window.open(data.downloadUrl, "_blank");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [polling, jobId]);

  return (
    <div>
      <button onClick={startJob}>Create/Reuse File</button>
      {ready && <p>✅ File ready for download</p>}
      {!ready && polling && <p>⏳ Processing...</p>}
    </div>
  );
}

// const authenticationAPI = (Email: string) => {
//   isVerified: "true|false";
//   authenticationType: "GSA|ADMIN|";
// };
// const buildingDataAPI = (session: string, year: string) => {
//   [
//     {
//       buildingID: "AB1",
//       buildingName: "Admin Block",
//       floorIDs: [-1, 0, 1, 2, 3],
//       numberOfRooms: 240,
//       buildingImage: "URL",
//       totalOccupancy: 780,
//       todayOccupied: 550,
//     },
//   ];
// };
// const floorDataAPI = (
//   session: string,
//   year: string,
//   currentTime: string,
//   buildingID: string,
//   floorID: string
// ) => {
//   return {
//     buildingID: "AB1",
//     floorName: "Lower Ground",
//     numberOfRooms: 40,
//     totalOccupancyOnFloor: 71,
//     floorArea: 750,
//     occupied: 55,
//     rooms: [
//       roomTypeID#SeminarHall : {
//         roomId: "AB-1004",
//         roomName: "Admin Block-Seminar Hall 4",
//         roomOccupancy: 8,
//         hasSubrooms: false,
//         roomOccupied: 5,
//         curruntlyOccupiedBy: "Btech-CSE",
//         startTime: "10:00",
//         endTime: "11:30",
//         roomType: "Seminar Hall",
//       },
//     ],
//   };
// };

// const roomDataAPI = (
//   session: string,
//   year: string,
//   currentDate: string,
//   buildingID: string,
//   floor: string,
//   roomID: string,
//   facultyBlockid?: string | null
// ) => {
//   return {
//     roomId: "AB-1004",
//     roomName: "Admin Block-Seminar Hall 4",
//     totalSlots: 8,
//     slotsOccupied: 5,
//     curruntlyOccupiedBy: "Btech-CSE",
//     currentTimeSlot: "10:00 to 11:30",
//     roomType: "Seminar Hall",
//     allSlotsBooked: [
//       {
//         allocationID: "231012",
//         allocatedTo: "Mr. Yogesh",
//         purpose: "Seminar on APIs",
//         startDate: "10:00",
//         endDate: "11:30",
//         allocationStatus: "Booked",
//       },
//     ],
//   };
// };

// const facultyBlockDataAPI = (
//   session: string,
//   year: string,
//   currentTime: string,
//   buildingID: string,
//   floor: string,
//   roomID: string
// ) => {
//   return {
//     roomId: "AB-1004",
//     units: [
//       {
//         facultyBlockUnitId: "222",
//         unitNumber: "222",
//         unitType: "cubical|workstation",
//         startDate: "10:00",
//         endDate: "11:30",
//         unitCapacity: 2,
//         unitOccupied: 1,
//       },
//     ],
//   };
// };
