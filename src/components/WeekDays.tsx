import React from "react";
import { Check } from "lucide-react"; // Importing the check icon

// Define the type for the component props
interface WeekdaySelectorProps {
  value: string[]; // An array of selected weekday abbreviations
  onChange: (selectedDays: string[]) => void; // Callback function to update the parent state
}

// A constant array of all weekdays with their full and abbreviated names
const WEEKDAYS = [
  { abbr: "Mon", full: "Monday" },
  { abbr: "Tue", full: "Tuesday" },
  { abbr: "Wed", full: "Wednesday" },
  { abbr: "Thu", full: "Thursday" },
  { abbr: "Fri", full: "Friday" },
  { abbr: "Sat", full: "Saturday" },
  { abbr: "Sun", full: "Sunday" },
];

export const WeekdaySelector: React.FC<WeekdaySelectorProps> = ({
  value,
  onChange,
}) => {
  const handleDayToggle = (day: string) => {
    const isSelected = value.includes(day);

    if (isSelected) {
      const newSelectedDays = value.filter((d) => d !== day);
      onChange(newSelectedDays);
    } else {
      const newSelectedDays = [...value, day];
      onChange(newSelectedDays);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
      {WEEKDAYS.map((day) => (
        <div
          key={day.abbr}
          onClick={() => handleDayToggle(day.abbr)}
          className={`
            cursor-pointer
            px-3 py-1
            rounded-full
            text-xs font-medium
            transition-colors duration-200
            shadow-sm
            select-none
            flex items-center space-x-1
            ${
              // Conditional classes for selected vs unselected state
              value.includes(day.abbr)
                ? "bg-orange-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }
          `}
        >
          {/* Conditionally render the checkmark icon */}
          {value.includes(day.abbr) && <Check size={16} />}
          <span>{day.full}</span>
        </div>
      ))}
    </div>
  );
};
