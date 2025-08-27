"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
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
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { useSelector } from "react-redux";
import { Building1, DashboardDataResponse } from "@/types";

export default function Dashboard() {
  const [data, setData] = useState<DashboardDataResponse | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState(false);
  const acadmeicYear = useSelector(
    (state: any) => state.dataState.academicYear
  );
  const acadmeicSession = useSelector(
    (state: any) => state.dataState.academicSession
  );
  const [days, setDays] = useState("7");
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoadingDashboard(true);
      try {
        const requestBody = {
          noOfDays: days,
          acadmeicSession: acadmeicSession,
          acadmeicYear: acadmeicYear,
        };
        let response = callApi<DashboardDataResponse>(
          process.env.NEXT_PUBLIC_GET_DASHBOARD_DATA || URL_NOT_FOUND,
          requestBody
        );
        let res = await response;
        setData(res.data || null);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoadingDashboard(false);
      }
    };
    fetchDashboardData();
  }, [days, acadmeicYear, acadmeicSession]);

  const [allBuildingsData, setAllBuildingsData] = useState<Building1[]>([]);

  useEffect(() => {
    const fetchBuildings = async () => {
      setIsLoadingBuildings(true);
      try {
        const reqBody = {
          acadSession: `${acadmeicSession}`,
          acadYear: `${acadmeicYear}`,
        };
        const response = await callApi<Building1[]>(
          process.env.NEXT_PUBLIC_GET_BUILDING_LIST || URL_NOT_FOUND
        );
        console.log(response);
        if (response.success) {
          setAllBuildingsData(response.data || []);
        }
      } catch (error) {
        console.error('Error fetching buildings:', error);
      } finally {
        setIsLoadingBuildings(false);
      }
    };
    fetchBuildings();
  }, []);

  const kpiCards = [
    {
      title: "Total Buildings",
      value: allBuildingsData?.length,
      iconSrc: "/images/office-building-outline.svg",
      alt: "Building icon",
    },
    {
      title: "Total Floors",
      value: allBuildingsData?.reduce((sum, b) => {
        return sum + b.floors?.length;
      }, 0),
      iconSrc: "/images/floor-plan.svg",
      alt: "Floor plan icon",
    },
    {
      title: "Total Rooms",
      value: allBuildingsData.reduce((sum, b) => {
        return (
          sum +
          b.floors.reduce((fsum, f) => {
            return fsum + f.totalRoomsOnFloor;
          }, 0)
        );
      }, 0),
      iconSrc: "/images/house-door.svg",
      alt: "Room icon",
    },
    {
      title: "Average Occupancy",
      value: data?.avgOccupancy,
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
          <select
            onChange={(e) => setDays(e.target.value)}
            className="h-fit w-fit rounded-md bg-gray-100 px-1 py-1 text-[10px] font-light text-gray-700"
          >
            <option value="7">7 D</option>
            <option value="30">30 D</option>
          </select>
        </div>
      ),
    },
    {
      title: "Utilization Request",
      value: data?.utilizationRequests,
      iconSrc: "/images/user-exclamation.svg",
      alt: "Request icon",
    },
    {
      title: "Available Facilities",
      value: data?.availabeFacilities,
      iconSrc: "/images/cil-library-building.svg",
      alt: "Facility icon",
    },
  ];

  function HourlyOccupancyChart() {
    return (
      <div className=" p-6 rounded-lg max-w-3xl min-w-2xl bg-white border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex text-lg font-semibold text-gray-800">
            <TrendingUp className="text-blue-500 mr-2" size={24} />
            Occupancy Pattern
          </h2>
          <div className="flex items-center text-sm text-gray-600 mr-4">
            <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
            Occupancy Rate
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={data?.graphData}
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
              dataKey="time"
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
        value: data?.totalFacilities,
        description: `Across ${data?.totalBuildings} Buildings`,
        icon: <Build className="text-blue-500" size={24} />,
      },
      {
        id: 2,
        title: "Active Sessions",
        value: data?.activeSessions,
        description: "Currently in progress",
        icon: <Users className="text-green-500" size={24} />,
      },
      {
        id: 3,
        title: "Maintenance Issues",
        value: "7",
        description: "High priority",
        icon: <AlertTriangle className="text-yellow-500" size={24} />,
      },
    ];

    return (
      <div className="bg-white p-6 rounded-lg w-full mt-4 lg:mt-0 lg:ml-4 mx-auto border border-gray-200">
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
        <div className="grid grid-flow-col lg:grid-flow-row">
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

  return (
    <div>
      <section className="mb-8">
        <h2 className="mb-4 text-base font-semibold text-gray-800 md:ml-2">
          Key Metrics
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-6 md:grid-cols-3">
          {isLoadingDashboard || isLoadingBuildings ? (
            // Loading skeleton for KPI cards
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-lg bg-white p-4 shadow-sm animate-pulse">
                <div className="mb-2 flex items-center justify-between">
                  <div className="h-6 w-6 bg-gray-200 rounded"></div>
                  <div className="h-4 w-16 bg-gray-200 rounded"></div>
                </div>
                <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            ))
          ) : (
            kpiCards.map((card) => (
              <div key={card.title} className="rounded-lg bg-white p-4 shadow-sm">
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
            ))
          )}
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
            <div className=" flex space-x-4 hidden ">
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
            {isLoadingDashboard ? (
              // Loading skeleton for charts
              <>
                <div className="p-6 rounded-lg max-w-3xl min-w-2xl bg-white border border-gray-200 animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-48 mb-4"></div>
                  <div className="h-64 bg-gray-200 rounded"></div>
                </div>
                <div className="p-6 rounded-lg max-w-3xl min-w-2xl bg-white border border-gray-200 animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-32 mb-4"></div>
                  <div className="h-64 bg-gray-200 rounded"></div>
                </div>
              </>
            ) : (
              <>
                <HourlyOccupancyChart />
                <SummaryChart />
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
