export default function Page() {
  return <div>Default Page</div>;
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

