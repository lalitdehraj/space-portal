"use client";

import React from "react";

const dummyData = [
  {
    day: "Monday",
    classes: [
      {
        time: "9:00 AM - 10:00 AM",
        subject: "Mathematics",
        room: "Room 101",
        teacher: "Mr. Smith",
      },
      {
        time: "10:00 AM - 11:00 AM",
        subject: "Physics",
        room: "Room 102",
        teacher: "Ms. Johnson",
      },
      {
        time: "11:00 AM - 12:00 PM",
        subject: "Chemistry",
        room: "Room 103",
        teacher: "Dr. Brown",
      },
      {
        time: "1:00 PM - 2:00 PM",
        subject: "Computer Science",
        room: "Room 104",
        teacher: "Mr. Allen",
      },
      {
        time: "2:00 PM - 3:00 PM",
        subject: "Physical Education",
        room: "Gym",
        teacher: "Coach Carter",
      },
    ],
  },
  {
    day: "Tuesday",
    classes: [
      {
        time: "9:00 AM - 10:00 AM",
        subject: "Biology",
        room: "Room 104",
        teacher: "Dr. Green",
      },
      {
        time: "10:00 AM - 11:00 AM",
        subject: "History",
        room: "Room 105",
        teacher: "Ms. White",
      },
      {
        time: "11:00 AM - 12:00 PM",
        subject: "English",
        room: "Room 106",
        teacher: "Mr. Black",
      },
      {
        time: "1:00 PM - 2:00 PM",
        subject: "Art",
        room: "Room 107",
        teacher: "Ms. Blue",
      },
      {
        time: "2:00 PM - 3:00 PM",
        subject: "Music",
        room: "Room 108",
        teacher: "Mr. Gray",
      },
    ],
  },
  {
    day: "Wednesday",
    classes: [
      {
        time: "9:00 AM - 10:00 AM",
        subject: "Economics",
        room: "Room 107",
        teacher: "Mr. Adams",
      },
      {
        time: "10:00 AM - 11:00 AM",
        subject: "Geography",
        room: "Room 108",
        teacher: "Ms. Taylor",
      },
      {
        time: "11:00 AM - 12:00 PM",
        subject: "Political Science",
        room: "Room 109",
        teacher: "Dr. Carter",
      },
      {
        time: "1:00 PM - 2:00 PM",
        subject: "Philosophy",
        room: "Room 110",
        teacher: "Dr. White",
      },
      {
        time: "2:00 PM - 3:00 PM",
        subject: "Psychology",
        room: "Room 111",
        teacher: "Dr. Green",
      },
    ],
  },
  {
    day: "Thursday",
    classes: [
      {
        time: "9:00 AM - 10:00 AM",
        subject: "Mathematics",
        room: "Room 101",
        teacher: "Mr. Smith",
      },
      {
        time: "10:00 AM - 11:00 AM",
        subject: "Physics",
        room: "Room 102",
        teacher: "Ms. Johnson",
      },
      {
        time: "11:00 AM - 12:00 PM",
        subject: "Chemistry",
        room: "Room 103",
        teacher: "Dr. Brown",
      },
      {
        time: "1:00 PM - 2:00 PM",
        subject: "Computer Science",
        room: "Room 104",
        teacher: "Mr. Allen",
      },
      {
        time: "2:00 PM - 3:00 PM",
        subject: "Physical Education",
        room: "Gym",
        teacher: "Coach Carter",
      },
    ],
  },
  {
    day: "Friday",
    classes: [
      {
        time: "9:00 AM - 10:00 AM",
        subject: "Biology",
        room: "Room 104",
        teacher: "Dr. Green",
      },
      {
        time: "10:00 AM - 11:00 AM",
        subject: "History",
        room: "Room 105",
        teacher: "Ms. White",
      },
      {
        time: "11:00 AM - 12:00 PM",
        subject: "English",
        room: "Room 106",
        teacher: "Mr. Black",
      },
      {
        time: "1:00 PM - 2:00 PM",
        subject: "Art",
        room: "Room 107",
        teacher: "Ms. Blue",
      },
      {
        time: "2:00 PM - 3:00 PM",
        subject: "Music",
        room: "Room 108",
        teacher: "Mr. Gray",
      },
    ],
  },
  {
    day: "Saturday",
    classes: [
      {
        time: "9:00 AM - 10:00 AM",
        subject: "Environmental Science",
        room: "Room 112",
        teacher: "Ms. Green",
      },
      {
        time: "10:00 AM - 11:00 AM",
        subject: "Statistics",
        room: "Room 113",
        teacher: "Mr. Brown",
      },
      {
        time: "11:00 AM - 12:00 PM",
        subject: "Data Science",
        room: "Room 114",
        teacher: "Dr. White",
      },
      {
        time: "1:00 PM - 2:00 PM",
        subject: "Robotics",
        room: "Room 115",
        teacher: "Mr. Black",
      },
      {
        time: "2:00 PM - 3:00 PM",
        subject: "AI & ML",
        room: "Room 116",
        teacher: "Dr. Gray",
      },
    ],
  },
  {
    day: "Sunday",
    classes: [
      {
        time: "9:00 AM - 10:00 AM",
        subject: "Yoga",
        room: "Gym",
        teacher: "Coach Carter",
      },
      {
        time: "10:00 AM - 11:00 AM",
        subject: "Meditation",
        room: "Room 117",
        teacher: "Ms. Blue",
      },
      {
        time: "11:00 AM - 12:00 PM",
        subject: "Ethics",
        room: "Room 118",
        teacher: "Dr. Green",
      },
      {
        time: "1:00 PM - 2:00 PM",
        subject: "Creative Writing",
        room: "Room 119",
        teacher: "Ms. White",
      },
      {
        time: "2:00 PM - 3:00 PM",
        subject: "Public Speaking",
        room: "Room 120",
        teacher: "Mr. Adams",
      },
    ],
  },
];

export default function TimeTableUI() {
  // Extract unique time slots
  const timeSlots = Array.from(
    new Set(dummyData.flatMap((day) => day.classes.map((cls) => cls.time)))
  );

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ textAlign: "center", marginBottom: "20px" }}>
        College Timetable
      </h1>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "center",
        }}
      >
        <thead>
          <tr>
            <th style={{ border: "1px solid #ccc", padding: "10px" }}>Day</th>
            {timeSlots.map((time, index) => (
              <th
                key={index}
                style={{ border: "1px solid #ccc", padding: "10px" }}
              >
                {time}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dummyData.map((dayData, index) => (
            <tr key={index}>
              <td
                style={{
                  border: "1px solid #ccc",
                  padding: "10px",
                  fontWeight: "bold",
                }}
              >
                {dayData.day}
              </td>
              {timeSlots.map((time, timeIndex) => {
                const classData = dayData.classes.find(
                  (cls) => cls.time === time
                );
                return (
                  <td
                    key={timeIndex}
                    style={{ border: "1px solid #ccc", padding: "10px" }}
                  >
                    {classData ? (
                      <>
                        <div>{classData.subject}</div>
                        <div style={{ fontSize: "0.9em", color: "#555" }}>
                          {classData.room}
                        </div>
                        <div style={{ fontSize: "0.8em", color: "#777" }}>
                          {classData.teacher}
                        </div>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
