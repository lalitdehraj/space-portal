// src/components/Header.js
"use client";
import React from "react";
import Image from "next/image";

export default function Header() {
  return (
    <header className="flex w-full items-center justify-between bg-white px-4 py-2 shadow-sm md:px-6">
      {/* Search bar section: Flexible and responsive */}
      <div className="relative mr-4 flex-1 max-w-sm">
        <input
          type="text"
          placeholder="Search"
          className="w-full rounded-lg border border-[#EBEDF2] bg-[#F5F6F8] py-2 pl-12 pr-4 text-sm text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300"
          aria-label="Search"
        />
        <img
          src="/images/search-normal.svg"
          alt="Search icon"
          className="h-[20px] w-[20px] absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
        />
      </div>

      <div className="flex items-center space-x-2 md:space-x-4">
        <select className="hidden rounded-md px-2 py-2 text-xs text-gray-700 focus:outline-none md:block">
          <option>Jan - March</option>
          <option>March - jun</option>
          <option>Jun - Sept</option>
          <option>Sept - Dec</option>
        </select>
        <select className="hidden rounded-md  px-2 py-2 text-xs text-gray-700 focus:outline-none md:block">
          <option>2024</option>
          <option>2025</option>
        </select>

        <button className="p-2 text-gray-600 transition-colors hover:text-blue-600 hidden">
          <img
          className="h-[24px] w-[24px]"
            src="/images/messages.svg"
            alt="Messages"
          />
        </button>

        <button className="p-2 text-gray-600 transition-colors hover:text-blue-600">
          <Image
            src="/images/notification.svg"
            alt="Notifications"
            width={24}
            height={24}
          />
        </button>

        <div className="flex items-center space-x-2">
          <Image
            src="/images/avatar-svgrepo-com.svg"
            alt="User Avatar"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full"
          />
        </div>
      </div>
    </header>
  );
}
