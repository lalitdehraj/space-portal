import React from "react";
import { X } from "lucide-react";
import moment from "moment";
import { Maintenance } from "@/types";

type MaintenanceInfoModalProps = {
  maintenance: Maintenance | null; // maintenance data to show
  onClose: () => void; // close modal
};

export default function MaintenanceInfoModal({ maintenance, onClose }: MaintenanceInfoModalProps) {
  if (!maintenance) return null;

  // Parse time from the API format (e.g., "0001-01-02T09:00:00Z")
  const startTimeStr = maintenance.startTime.split("T")[1]?.split("Z")[0] || "09:00:00";
  const endTimeStr = maintenance.endTime.split("T")[1]?.split("Z")[0] || "10:30:00";

  // Check if the maintenance slot is fully elapsed (past slot)
  const isSlotFullyElapsed = () => {
    const now = moment();
    const slotEnd = moment(`${moment(maintenance.maintanceDate).format("YYYY-MM-DD")} ${endTimeStr.substring(0, 5)}`);
    return now.isAfter(slotEnd);
  };

  // Check if this is a current ongoing maintenance slot (same date as today and currently in progress)
  const isCurrentOngoingSlot = () => {
    const now = moment();
    const slotDate = moment(maintenance.maintanceDate).format("YYYY-MM-DD");
    const today = now.format("YYYY-MM-DD");

    if (slotDate !== today) return false;

    const slotStart = moment(`${slotDate} ${startTimeStr.substring(0, 5)}`);
    const slotEnd = moment(`${slotDate} ${endTimeStr.substring(0, 5)}`);

    return now.isAfter(slotStart) && now.isBefore(slotEnd);
  };

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-600">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl px-8 py-6">
        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close">
          <X className="h-6 w-6" />
        </button>

        {/* Title */}
        <h2 className="font-semibold text-gray-700 mb-6 flex items-center gap-2">
          <span className="text-red-500">🔧</span>
          Maintenance Details
        </h2>

        {/* Info Section */}
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-gray-500">Maintenance Type</p>
            <p className="font-medium text-gray-800 capitalize">{maintenance.maintainenceType || "Scheduled Maintenance"}</p>
          </div>

          <div>
            <p className="text-gray-500">Room ID</p>
            <p className="font-medium text-gray-800">{maintenance.roomid}</p>
          </div>

          <div>
            <p className="text-gray-500">Building ID</p>
            <p className="font-medium text-gray-800">{maintenance.buildingId}</p>
          </div>

          <div>
            <p className="text-gray-500">Date</p>
            <p className="font-medium text-gray-800">{moment(maintenance.maintanceDate).format("dddd, MMM D, YYYY")}</p>
          </div>

          <div>
            <p className="text-gray-500">Time</p>
            <p className="font-medium text-gray-800">
              {startTimeStr.substring(0, 5)} - {endTimeStr.substring(0, 5)}
            </p>
          </div>

          {maintenance.description && (
            <div>
              <p className="text-gray-500">Description</p>
              <p className="font-medium text-gray-800">{maintenance.description}</p>
            </div>
          )}

          <div>
            <p className="text-gray-500">Status</p>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 text-xs rounded-full ${maintenance.isMainteneceActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
              >
                {maintenance.isMainteneceActive ? "Active" : "Inactive"}
              </span>
              {isCurrentOngoingSlot() && <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Currently Ongoing</span>}
              {isSlotFullyElapsed() && <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Completed</span>}
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {isCurrentOngoingSlot() && (
          <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700">This maintenance is currently in progress.</p>
          </div>
        )}

        {isSlotFullyElapsed() && (
          <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">This maintenance has been completed.</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8">
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300 transition">
              Close
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
