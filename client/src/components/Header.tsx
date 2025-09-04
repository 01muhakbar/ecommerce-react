import React from "react";

// --- Icon Components ---
const MenuIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  return (
    <header className="bg-white shadow-sm p-4 flex items-center">
      <button onClick={toggleSidebar} className="text-gray-500 mr-4 lg:hidden">
        <MenuIcon className="h-6 w-6" />
      </button>
      <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
    </header>
  );
};

export default Header;
