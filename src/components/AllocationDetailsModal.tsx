import React from "react";
import { X, Trash2 } from "lucide-react";
import moment from "moment";
import { Occupant } from "@/types";

type AllocationDetailsModalProps = {
  occupant: Occupant | null; // occupant data to show
  onClose: () => void; // close modal
  onDelete: (id: string) => void; // delete callback
  isManagedByThisUser: Boolean;
};

export default function AllocationDetailsModal({
  occupant,
  onClose,
  isManagedByThisUser,
  onDelete,
}: AllocationDetailsModalProps) {
  if (!occupant) return null;

  return (
    <section className="fixed inset-0 z-50 h-screen w-screen bg-[#00000070] flex items-center justify-center text-gray-600">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl px-8 py-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
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

          <div>
            <p className="text-gray-500">Type</p>
            <p className="font-medium text-gray-800">{occupant.type}</p>
          </div>

          <div>
            <p className="text-gray-500">Date</p>
            <p className="font-medium text-gray-800">
              {moment(occupant.scheduledDate).format("dddd, MMM D, YYYY")}
            </p>
          </div>

          <div>
            <p className="text-gray-500">Time</p>
            <p className="font-medium text-gray-800">
              {typeof occupant.startTime === "string"
                ? occupant.startTime
                : moment(occupant.startTime).format("HH:mm")}{" "}
              -{" "}
              {typeof occupant.endTime === "string"
                ? occupant.endTime
                : moment(occupant.endTime).format("HH:mm")}
            </p>
          </div>
        </div>

        {/* Actions */}
        {/* {console.log("isEditable value:", occupant.isEditable, typeof occupant.isEditable)} */}
        {occupant.isEditable === "true" && isManagedByThisUser && (
          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onDelete(occupant.Id)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg flex items-center gap-2 hover:bg-orange-600 transition"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
