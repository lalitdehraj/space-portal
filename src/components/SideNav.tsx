// src/components/SideNav.tsx
"use client";

import React, { FC, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useDispatch } from "react-redux";
import { setHeaderTextId } from "@/app/feature/dataSlice";
import { useRouter } from "next/navigation";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND } from "@/constants";
import { UserProfile } from "@/types";

type NavLink = {
  title: string;
  href: string;
  iconSrc?: string;
  alt: string;
};

const navLinks: NavLink[] = [
  {
    title: "Dashboard",
    href: "/space-portal/dashboard",
    iconSrc: "/images/element-4.svg",
    alt: "Dashboard icon",
  },
];

const spaceManagementLinks: NavLink[] = [
  {
    title: "Building - Floor - Rooms",
    href: "/space-portal/buildings",
    iconSrc: "/images/menu-board.svg",
    alt: "Building icon",
  },
];

const maintenanceLinks: NavLink[] = [
  {
    title: "Add Allocation",
    href: "/space-portal/allocation",
    iconSrc: "/images/dollar-square.svg",
    alt: "Allocation icon",
  },
  {
    title: "Request Approval",
    href: "/space-portal/requests",
    iconSrc: "/images/dollar-square.svg",
    alt: "Maintenance icon",
  },
];

const reportsLinks: NavLink[] = [
  {
    title: "Space Utilization Reports",
    href: "/space-portal/reports",
    iconSrc: "/images/dollar-square.svg",
    alt: "Reports icon",
  },
];

interface SideNavProps {
  onClose: () => void;
}

const NavItem: FC<NavLink & { onClose: () => void }> = ({
  href,
  iconSrc,
  alt,
  title,
  onClose,
}) => {
  const pathname = usePathname();
  const isActive =
    pathname.replace("%20", " ") === href || pathname.includes(href);

  const dispatcher = useDispatch();
  return (
    <Link
      onClickCapture={() => dispatcher(setHeaderTextId(title))}
      href={href}
      className={`ml-10 flex items-center rounded p-2 text-sm transition-colors duration-200 hover:bg-gray-200 ${
        isActive
          ? "border-l-4 border-[#F26722] font-medium text-gray-800"
          : "border-l-4 border-transparent text-gray-700"
      }`}
      onClick={onClose}
    >
      {iconSrc && (
        <img src={iconSrc} alt={alt} className="mr-3 h-[20px] w-[20px]" />
      )}
      {title}
    </Link>
  );
};

const SideNav: FC<SideNavProps> = ({ onClose }) => {
  const dispatcher = useDispatch();
  const router = useRouter();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  useEffect(() => {
    const fetchUserRoles = async () => {
      const response = await callApi<UserProfile[]>(
        process.env.NEXT_PUBLIC_GET_USER || URL_NOT_FOUND
      );
      if (response.success) {
        const roles = response.data?.map((u) => u.userRole) || [];
        const uniqueRoles = Array.from(new Set(roles));
        setUserRoles(uniqueRoles);
      }
    };
    fetchUserRoles();
  }, []);
  return (
    <aside className="flex h-full w-full md:w-64 flex-col bg-gray-50 shadow-lg ">
      <div className="flex items-center justify-between p-4 md:justify-center ">
        <img
          onClick={() => {
            router.push("/space-portal/dashboard");
          }}
          src="https://jaipur.manipal.edu/img/manipal-university-jaipur-logo-01.svg"
          alt="Manipal University Jaipur Logo"
          className="h-[52px] w-[160px] mt-6 mb-6 object-contain"
        />
        {/* Close button visible only on mobile */}
        <button
          onClick={onClose}
          className="rounded-full p-2 md:hidden"
          aria-label="Close menu"
        >
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      <nav className="flex-grow overflow-y-auto">
        <div className="flex flex-col border-t border-[#F26722] py-4">
          {navLinks.map((link) => (
            <NavItem key={link.href} {...link} onClose={onClose} />
          ))}
        </div>

        <div className="flex flex-col border-t border-[#F26722] py-4">
          <div className="px-8 pb-2 text-xs text-gray-500">
            Space Management
          </div>
          <div className="space-y-0.5">
            {spaceManagementLinks.map((link) => (
              <NavItem key={link.href} {...link} onClose={onClose} />
            ))}
            {userRoles.length > 0 &&
              userRoles.map(
                (role) =>
                  role && (
                    <NavItem
                      key={`space-portal/role/${role}`}
                      alt={role}
                      href={`/space-portal/role/${role}`}
                      title={`${role}`}
                      iconSrc="/images/menu-board.svg"
                      onClose={onClose}
                    />
                  )
              )}
          </div>
        </div>

        <div className="flex flex-col border-t border-[#F26722] py-4">
          <div className="px-8 pb-2 text-xs text-gray-500">Maintenance</div>
          {maintenanceLinks.map((link) => (
            <NavItem key={link.href} {...link} onClose={onClose} />
          ))}
        </div>

        <div className="flex flex-col border-t border-[#F26722] py-4">
          <div className="px-8 pb-2 text-xs text-gray-500">Reports</div>
          {reportsLinks.map((link) => (
            <NavItem key={link.href} {...link} onClose={onClose} />
          ))}
        </div>
      </nav>
    </aside>
  );
};

export default SideNav;
