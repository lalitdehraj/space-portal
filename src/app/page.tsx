"use client";
import { Card, Title, Text, Badge, Button } from "@tremor/react";
import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

function Login() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loginError, setLoginError] = React.useState("");
  const handleLogin = () => {
    if (username === "admin" && password === "password") {
      router.push("/admin");
    } else {
      setLoginError("Invalid username or password");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-[#f8f4f4] to-white p-4">
      <Card className="w-full max-w-md bg-white shadow-xl rounded-xl overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="flex items-center">
                <Image
                  src="/images/manipal-logo.jpg"
                  alt="Manipal University Logo"
                  width={60}
                  height={60}
                  className="rounded-md mr-4"
                />
                <div>
                  <h1 className="text-xl font-bold text-gray-800">
                    Manipal University
                  </h1>
                  <p className="text-[#C43A31] text-sm">Jaipur</p>
                </div>
              </div>
            </div>
          </div>

          <Title className="text-center text-2xl font-bold text-gray-800 mb-8">
            Space Utilization Dashboard
          </Title>

          {loginError && (
            <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2 text-red-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {loginError}
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Username
            </label>
            <div className="relative">
              <div className="absolute left-3 top-3 text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C43A31] focus:border-transparent text-gray-700"
                placeholder="Enter your username"
                onKeyUp={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-gray-700 text-sm font-medium mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-3 text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C43A31] focus:border-transparent text-gray-700"
                placeholder="Enter your password"
                onKeyUp={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
            </div>
          </div>
          <button
            onClick={handleLogin}
            className="w-full py-3 bg-[#C43A31] text-white rounded-lg hover:bg-[#a1302a] transition-colors font-medium flex items-center justify-center"
          >
            <span>Login</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 ml-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 11H7a1 1 0 100-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </Card>
    </div>
  );
}

export default Login;
