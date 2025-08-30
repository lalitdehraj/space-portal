"use client";

import React from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center font-sans"
      style={{
        backgroundImage: `url("/images/manipal-building.png")`,
      }}
    >
      <div className="absolute inset-0 bg-black opacity-10" />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white bg-opacity-90 p-8 text-center shadow-2xl">
        <div className="mb-8">
          <Image
            src="/images/manipal-complete-logo.png"
            alt="Manipal University Jaipur Logo"
            height={200}
            width={200}
            className="mx-auto object-contain"
            priority
          />
        </div>

        <h1 className="mb-2 text-2xl text-gray-700">Space Management Portal</h1>

        <p className="mb-6 text-sm text-gray-500">
          Welcome to the MUJ Space Management Portal
        </p>

        <button
          type="button"
          className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white py-3 px-6 text-base font-semibold text-gray-700 transition duration-300 ease-in-out hover:bg-gray-100"
          onClick={async () => {
            await signIn("azure-ad", {
              callbackUrl: "/space-portal/dashboard",
            });
          }}
        >
          <Image
            height={20}
            width={20}
            src="/images/microsoft-logo.png"
            alt="Microsoft logo"
            className="h-5 w-5 mr-4"
          />
          Continue with MUJ ID
        </button>
      </div>
    </div>
  );
}
