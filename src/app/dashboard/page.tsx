"use client";
import React, { useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { Menu } from "lucide-react";
import SideNav from "@/components/SideNav";
import Header from "@/components/Header";
import { buildingsData } from "@/constants";
import { AcademicSessions, Building } from "@/types";
import { setAllBuildingsData } from "../feature/dataSlice";
import {
  Building as Build,
  Users,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import useSideNavState from "@/hooks/useSideNavState";

const kpiCards = [
  {
    title: "Total Buildings",
    value: "5",
    iconSrc: "/images/office-building-outline.svg",
    alt: "Building icon",
  },
  {
    title: "Total Floors",
    value: "5",
    iconSrc: "/images/floor-plan.svg",
    alt: "Floor plan icon",
  },
  {
    title: "Total Rooms",
    value: "750",
    iconSrc: "/images/house-door.svg",
    alt: "Room icon",
  },
  {
    title: "Average Occupancy",
    value: "74%",
    iconSrc: "/images/seat-outline.svg",
    alt: "Seat icon",
    extraContent: (
      <div className="flex items-center">
        <Image
          src="/images/calendar.svg"
          alt="Calendar icon"
          height={16}
          width={16}
          className="mr-2"
        />
        <select className="h-fit w-fit rounded-md bg-gray-100 px-1 py-1 text-[10px] font-light text-gray-700">
          <option value="last 7 Days">7 D</option>
          <option value="last 30 Days">30 D</option>
        </select>
      </div>
    ),
  },
  {
    title: "Utilization Request",
    value: "75",
    iconSrc: "/images/user-exclamation.svg",
    alt: "Request icon",
  },
  {
    title: "Available Facilities",
    value: "12",
    iconSrc: "/images/cil-library-building.svg",
    alt: "Facility icon",
  },
];
import apiRequestHandler from "@/utils/apiIntercepter";
export default function Dashboard() {
  const res = async () => {
    console.log(`Lalit  ${process.env.NEXT_PUBLIC_GET_ACADMIC_CALENDER}`)
    const response = await apiRequestHandler.get(process.env.NEXT_PUBLIC_GET_ACADMIC_CALENDER||"")
    fetch("http://localhost:3000/api/getData")
    console.log(response.data)
  };
  useEffect(() => {
    res();
  }, []);
  const dispatch = useDispatch();
  const { isSideNavOpen, toggleSideNav } = useSideNavState();

  const data: Building[] = useSelector(
    (state: { dataState: { allBuildingsData: Building[] } }) =>
      state.dataState.allBuildingsData
  );

  useEffect(() => {
    if (!data || data.length === 0) {
      dispatch(setAllBuildingsData(buildingsData));
    }
  }, [dispatch, data]);

  const allBuildings = useMemo(() => data || [], [data]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans md:grid md:grid-cols-[256px_1fr]">
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-gray-50 transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isSideNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SideNav onClose={toggleSideNav} />
      </div>

      {isSideNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
          onClick={toggleSideNav}
        />
      )}

      <div className="flex flex-1 flex-col">
        <div className="sticky top-0 z-30 flex w-full items-center justify-between border-b bg-white p-4 shadow-sm md:hidden">
          <button onClick={toggleSideNav} className="text-gray-900">
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
          <div className="w-6" />
        </div>

        <div className="hidden md:block">
          <Header />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <section className="mb-8">
            <h2 className="mb-4 text-base font-semibold text-gray-800 md:ml-2">
              Key Metrics
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-6 md:grid-cols-3">
              {kpiCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-lg bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Image
                      src={card.iconSrc}
                      alt={card.alt}
                      height={24}
                      width={24}
                      className="h-6 w-6"
                    />
                    {card.extraContent}
                  </div>
                  <p className="text-xs text-gray-600">{card.title}</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-base font-semibold text-gray-800 md:ml-2">
              Building Occupancy Comparison
            </h2>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">
                    Occupancy Performance
                  </h3>
                  <p className="text-[10px] text-gray-500">
                    Comparative analysis across all campus facilities
                  </p>
                </div>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    className="flex items-center text-xs text-gray-800 transition-colors hover:text-gray-600"
                  >
                    <img
                      src="/images/bx-filter-alt.svg"
                      alt="Filter icon"
                      className="mr-1 h-[16px] w-[16px]"
                    />
                    Filter
                  </button>
                  <button
                    type="button"
                    className="flex items-center text-xs text-gray-800 transition-colors hover:text-gray-600"
                  >
                    <Image
                      src="/images/bx-download.svg"
                      alt="Download icon"
                      height={16}
                      width={16}
                      className="mr-1"
                    />
                    Export
                  </button>
                </div>
              </div>
              <div className="flex w-full flex-col justify-between mt-2 lg:flex-row">
                <HourlyOccupancyChart />
                <SummaryChart />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

const data = [
  { hour: "8:00", "Occupancy Rate": 45 },
  { hour: "9:00", "Occupancy Rate": 78 },
  { hour: "10:00", "Occupancy Rate": 92 },
  { hour: "11:00", "Occupancy Rate": 88 },
  { hour: "12:00", "Occupancy Rate": 65 },
  { hour: "13:00", "Occupancy Rate": 58 },
  { hour: "14:00", "Occupancy Rate": 80 },
  { hour: "15:00", "Occupancy Rate": 90 },
  { hour: "16:00", "Occupancy Rate": 75 },
  { hour: "17:00", "Occupancy Rate": 55 },
  { hour: "18:00", "Occupancy Rate": 30 },
  { hour: "19:00", "Occupancy Rate": 28 },
];

function HourlyOccupancyChart() {
  return (
    <div className=" p-6 rounded-lg max-w-3xl min-w-2xl bg-white border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex text-lg font-semibold text-gray-800">
          <TrendingUp className="text-blue-500 mr-2" size={24} />
          Hourly Occupancy Patterns
        </h2>
        <div className="flex items-center text-sm text-gray-600 mr-4">
          <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
          Occupancy Rate
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            className="text-xs"
            dataKey="hour"
            tickLine={false}
            axisLine={{ stroke: "#666666" }}
          />
          <YAxis
            className="text-xs"
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]} // Set Y-axis range from 0% to 100%
            tickCount={5} // Number of ticks on Y-axis (0%, 25%, 50%, 75%, 100%)
            tickLine={false}
            axisLine={{ stroke: "#666666" }}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, "Occupancy Rate"]}
            labelFormatter={(label) => `Hour: ${label}`}
            contentStyle={{
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            }}
            itemStyle={{ color: "#333" }}
          />
          <Line
            type="monotone"
            dataKey="Occupancy Rate"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 1 }} // Dots on the line
            activeDot={{
              r: 6,
              fill: "#3b82f6",
              stroke: "#fff",
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="items-center justify-between mt-4 hidden">
        <div className="mt-6 text-center">
          <p className="text-green-600 text-lg font-semibold">92%</p>
          <p className="text-sm text-gray-600">Peak Usage</p>
        </div>
        <div className="mt-4 text-center">
          <p className="text-orange-500 text-lg font-semibold">67%</p>
          <p className="text-sm text-gray-600">Average</p>
        </div>
        <div className="mt-4 text-center">
          <p className="text-red-500 text-lg font-semibold">28%</p>
          <p className="text-sm text-gray-600">Lowest</p>
        </div>
      </div>
    </div>
  );
}

function SummaryChart() {
  const stats = [
    {
      id: 1,
      title: "Total Facilities",
      value: "156",
      description: "Across 6 Buildings",
      icon: <Build className="text-blue-500" size={24} />,
    },
    {
      id: 2,
      title: "Active Sessions",
      value: "89",
      description: "Currently in progress",
      icon: <Users className="text-green-500" size={24} />,
    },
    {
      id: 3,
      title: "Maintenance Issues",
      value: "7",
      description: "3 high priority",
      icon: <AlertTriangle className="text-yellow-500" size={24} />,
    },
    // {
    //   id: 4,
    //   title: "Avg Utilization",
    //   value: "78%",
    //   description: "This semester",
    //   icon: <TrendingUp className="text-purple-500" size={24} />,
    // },
  ];

  return (
    <div className="bg-white p-6 rounded-lg w-full max-w-sm mx-auto border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-bar-chart-2 mr-2 text-gray-600"
        >
          <line x1="18" x2="18" y1="20" y2="10" />
          <line x1="12" x2="12" y1="20" y2="4" />
          <line x1="6" x2="6" y1="20" y2="14" />
        </svg>
        Summary Statistics
      </h2>
      <div className="grid">
        {stats.map((stat) => (
          <div key={stat.id} className="flex items-center p-4 rounded-md">
            <div className="flex-shrink-0 mr-4">{stat.icon}</div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.title}</p>
              <p className="text-xs text-gray-500">{stat.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
