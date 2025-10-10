import React from "react";
import { X, Trash2, Edit3 } from "lucide-react";
import moment from "moment";
import { Occupant } from "@/types";

type AllocationDetailsModalProps = {
  occupant: Occupant | null; // occupant data to show
  onClose: () => void; // close modal
  onDelete: (id: string) => void; // delete callback
  onUpdate: () => void; // update callback
  isManagedByThisUser: boolean;
};

export default function AllocationDetailsModal({ occupant, onClose, isManagedByThisUser, onDelete, onUpdate }: AllocationDetailsModalProps) {
  if (!occupant) return null;

  // Check if the slot is fully elapsed (past slot)
  const isSlotFullyElapsed = () => {
    const now = moment();
    const slotEnd = moment(`${moment(occupant.scheduledDate).format("YYYY-MM-DD")} ${occupant.endTime}`);
    return now.isAfter(slotEnd);
  };

  // Check if this is a current ongoing slot (same date as today and currently in progress)
  const isCurrentOngoingSlot = () => {
    const now = moment();
    const slotDate = moment(occupant.scheduledDate).format("YYYY-MM-DD");
    const today = now.format("YYYY-MM-DD");

    if (slotDate !== today) return false;

    const slotStart = moment(`${slotDate} ${occupant.startTime}`);
    const slotEnd = moment(`${slotDate} ${occupant.endTime}`);

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
        <h2 className="font-semibold text-gray-700 mb-6">Allocation Details</h2>

        {/* Info Section */}
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-gray-500">Occupant</p>
            <p className="font-medium text-gray-800">{occupant.occupantName}</p>
          </div>

          <div className="flex gap-12">
            <div>
              <p className="text-gray-500">Type</p>
              <p className="font-medium text-gray-800">{occupant.type}</p>
            </div>
            {occupant.programCode && (
              <div>
                <p className="text-gray-500">Course</p>
                <p className="font-medium text-gray-800">{occupant.programCode}</p>
              </div>
            )}
          </div>

          <div>
            <p className="text-gray-500">Date</p>
            <p className="font-medium text-gray-800">{moment(occupant.scheduledDate).format("dddd, MMM D, YYYY")}</p>
          </div>

          <div>
            <p className="text-gray-500">Time</p>
            <p className="font-medium text-gray-800">
              {typeof occupant.startTime === "string" ? occupant.startTime : moment(occupant.startTime).format("HH:mm")} -{" "}
              {typeof occupant.endTime === "string" ? occupant.endTime : moment(occupant.endTime).format("HH:mm")}
            </p>
          </div>
        </div>

        {/* Actions */}
        {/* {console.log("isEditable value:", occupant.isEditable, typeof occupant.isEditable)} */}
        {occupant.isEditable === "true" && isManagedByThisUser && (
          <div className="mt-8">
            {/* Show message for current ongoing slots */}
            {isCurrentOngoingSlot() && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-700">This slot is currently ongoing. You can only unallocate the remaining time.</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300 transition">
                {isSlotFullyElapsed() ? "Close" : "Cancel"}
              </button>
              {!isSlotFullyElapsed() && (
                <>
                  {/* Hide Update button for current ongoing slots */}
                  {!isCurrentOngoingSlot() && (
                    <button onClick={onUpdate} className="px-4 py-2 bg-orange-500 text-white rounded-lg flex items-center gap-2 hover:bg-orange-600 transition">
                      <Edit3 className="w-4 h-4" />
                      Update
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(occupant.Id)}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg flex items-center gap-2 hover:bg-orange-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Un-allocate
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
