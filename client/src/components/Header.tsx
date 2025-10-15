import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, User, ChevronDown, X } from "lucide-react";
// import { useDebounce } from "@/hooks/useDebounce";

const Header = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  // const debouncedSearchQuery = useDebounce(searchQuery, 250);

  // Handle search query changes
  // useEffect(() => {
  //   // Perform search with debouncedSearchQuery
  // }, [debouncedSearchQuery]);

  return (
    <header className="relative flex items-center justify-between bg-white shadow-sm p-4 h-16">
      {/* Search Input */}
      <div className="relative">
        <div className="hidden md:block relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-xs pl-10 pr-4 py-2 border rounded-full bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
          />
        </div>
        <div className="md:hidden">
          <motion.button
            onClick={() => setIsSearchOpen(true)}
            whileTap={{ scale: 0.9 }}
          >
            <Search size={24} className="text-gray-600" />
          </motion.button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative">
          <motion.div whileTap={{ scale: 0.9 }}>
            <Bell size={24} className="text-gray-600 cursor-pointer" />
          </motion.div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              delay: 0.5,
            }}
            className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs rounded-full"
          >
            3
          </motion.div>
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <motion.button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 text-left"
            whileTap={{ scale: 0.95 }}
          >
            <User size={28} className="text-gray-600" />
            <div className="hidden md:block">
              <p className="text-sm font-medium">Admin</p>
              <p className="text-xs text-gray-500">Super Admin</p>
            </div>
            <ChevronDown
              size={16}
              className={`transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </motion.button>

          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15, ease: "easeInOut" }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 origin-top-right"
              >
                <ul className="py-1">
                  <li>
                    <a
                      href="#"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Profile
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Settings
                    </a>
                  </li>
                  <li>
                    <a
                      href="#"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Logout
                    </a>
                  </li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden absolute top-0 left-0 w-full h-full bg-white flex items-center p-4 z-20"
          >
            <Search
              className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Search..."
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-12 py-2 border rounded-full bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <motion.button
              onClick={() => setIsSearchOpen(false)}
              className="absolute right-6"
              whileTap={{ scale: 0.9 }}
            >
              <X size={24} className="text-gray-600" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
