// src/components/SideNav.tsx
"use client";

import React, { FC, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setHeaderTextId } from "@/app/feature/dataSlice";
import { RootState } from "@/app/store";
import { useRouter } from "next/navigation";
import { callApi } from "@/utils/apiIntercepter";
import { URL_NOT_FOUND, DISABLE_MENU_VISIBILITY_LOGIC } from "@/constants";
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
  {
    title: "Room Maintenance",
    href: "/space-portal/maintenance",
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

// OBE menu items (from obe module SideNav)
const obeLinks: NavLink[] = [
  {
    title: "Calculate CO",
    href: "/obe/calculate-co",
    iconSrc: "/images/element-4.svg",
    alt: "Calculate CO icon",
  },
  {
    title: "Course File",
    href: "/obe/course-file",
    iconSrc: "/images/menu-board.svg",
    alt: "Course File icon",
  },
];

interface SideNavProps {
  onClose: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: FC<CollapsibleSectionProps> = ({ title, isOpen, onToggle, children }) => (
  <div className="flex flex-col border-t border-[#F26722]">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between px-6 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
    >
      <span>{title}</span>
      {isOpen ? <ChevronDown size={18} className="shrink-0" /> : <ChevronRight size={18} className="shrink-0" />}
    </button>
    {isOpen && <div className="pb-2">{children}</div>}
  </div>
);

const NavItem: FC<NavLink & { onClose: () => void }> = ({ href, iconSrc, alt, title, onClose }) => {
  const pathname = usePathname();
  const isActive = pathname.replace("%20", " ") === href || pathname.includes(href);

  const dispatcher = useDispatch();
  return (
    <Link
      onClickCapture={() => dispatcher(setHeaderTextId(title))}
      href={href}
      className={`ml-10 flex items-center rounded p-2 text-sm transition-colors duration-200 hover:bg-gray-200 ${
        isActive ? "border-l-4 border-[#F26722] font-medium text-gray-800" : "border-l-4 border-transparent text-gray-700"
      }`}
      onClick={onClose}
    >
      {iconSrc && <img src={iconSrc} alt={alt} className="mr-3 h-[20px] w-[20px]" />}
      {title}
    </Link>
  );
};

const SideNav: FC<SideNavProps> = ({ onClose }) => {
  const router = useRouter();
  const pathname = usePathname();
  const isSpaceAdmin = useSelector((state: RootState) => state.dataState.isSpaceAdmin);
  const isOBEUser = useSelector((state: RootState) => state.dataState.isOBEUser);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<"space" | "obe" | null>("space");

  // Keep the section that contains the current page expanded
  useEffect(() => {
    if (pathname.startsWith("/obe")) {
      setOpenSection("obe");
    } else if (pathname.startsWith("/space-portal")) {
      setOpenSection("space");
    }
  }, [pathname]);

  useEffect(() => {
    if (!DISABLE_MENU_VISIBILITY_LOGIC && !isSpaceAdmin) return;
    const fetchUserRoles = async () => {
      const response = await callApi<UserProfile[]>(process.env.NEXT_PUBLIC_GET_USER || URL_NOT_FOUND);
      if (response.success) {
        const roles = response.data?.map((u) => u.userRole) || [];
        const allRoles = roles.flatMap((role) => (role ? role.split("|") : []));
        const uniqueRoles = Array.from(new Set(allRoles));
        setUserRoles(uniqueRoles.filter((role) => role !== "ADMIN"));
      }
    };
    fetchUserRoles();
  }, [isSpaceAdmin]);
  return (
    <aside className="flex h-full w-full md:w-64 flex-col bg-gray-50/90 shadow-lg ">
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
        <button onClick={onClose} className="rounded-full p-2 md:hidden" aria-label="Close menu">
          <X size={24} className="text-gray-600" />
        </button>
      </div>

      <nav className="grow overflow-y-auto">
        {(DISABLE_MENU_VISIBILITY_LOGIC || isSpaceAdmin) && (
          <CollapsibleSection
            title="Space Portal"
            isOpen={openSection === "space"}
            onToggle={() => setOpenSection((prev) => (prev === "space" ? null : "space"))}
          >
            <div className="flex flex-col space-y-0.5 py-2">
              {navLinks.map((link) => (
                <NavItem key={link.href} {...link} onClose={onClose} />
              ))}
              <div className="px-8 pb-1 pt-2 text-xs text-gray-500">Space Management</div>
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
              <div className="px-8 pb-1 pt-2 text-xs text-gray-500">Maintenance</div>
              {maintenanceLinks.map((link) => (
                <NavItem key={link.href} {...link} onClose={onClose} />
              ))}
              <div className="px-8 pb-1 pt-2 text-xs text-gray-500">Reports</div>
              {reportsLinks.map((link) => (
                <NavItem key={link.href} {...link} onClose={onClose} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {(DISABLE_MENU_VISIBILITY_LOGIC || isOBEUser) && (
          <CollapsibleSection title="OBE" isOpen={openSection === "obe"} onToggle={() => setOpenSection((prev) => (prev === "obe" ? null : "obe"))}>
            <div className="flex flex-col space-y-0.5 py-2">
              {obeLinks.map((link) => (
                <NavItem key={link.href} {...link} onClose={onClose} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {!DISABLE_MENU_VISIBILITY_LOGIC && !isSpaceAdmin && !isOBEUser && (
          <div className="border-t border-[#F26722] px-6 py-6 text-center text-sm text-gray-600">
            You don&apos;t have access to any of the page/section.
          </div>
        )}
      </nav>
    </aside>
  );
};

export default SideNav;
