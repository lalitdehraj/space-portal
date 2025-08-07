import React from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5,
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];

    const showLeftEllipsis = currentPage > Math.ceil(maxVisiblePages / 2);
    const showRightEllipsis =
      currentPage < totalPages - Math.floor(maxVisiblePages / 2);

    const numMiddlePages = maxVisiblePages - 2; // First + Last always shown

    let start = Math.max(2, currentPage - Math.floor(numMiddlePages / 2));
    let end = Math.min(totalPages - 1, start + numMiddlePages - 1);

    // Adjust start if end is too close to totalPages
    start = Math.max(2, end - numMiddlePages + 1);

    pages.push(1);

    if (showLeftEllipsis && start > 2) {
      pages.push("...");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (showRightEllipsis && end < totalPages - 1) {
      pages.push("...");
    }

    if (totalPages > 1) {
      pages.push(totalPages); // Always show last page
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="flex items-center justify-center p-4 space-x-2 font-inter">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-2 py-1 text-xs text-gray-700 bg-gray-100 rounded-lg shadow-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>

      {pages.map((page, index) =>
        page === "..." ? (
          <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            disabled={currentPage === page}
            className={`px-2 py-1 text-xs rounded-lg shadow-sm hover:scale-125 transition-transform duration-150 ${
              currentPage === page
                ? "bg-orange-500 text-white cursor-default"
                : "bg-white text-gray-700 hover:bg-gray-100 transition-colors"
            }`}
          >
            {page}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-2 py-1 text-xs text-gray-700 bg-gray-100 rounded-lg shadow-sm hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
