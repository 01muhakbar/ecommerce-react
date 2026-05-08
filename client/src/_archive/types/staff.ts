export type Staff = {
  id: number;
  name: string;
  email: string;
  contactNumber?: string;
  joiningDate?: string;
  role: "Admin" | "Manager" | "Staff" | "Super Admin";
  routes?: string[] | string | null;   // ⬅ longgar
  avatarUrl?: string;
  status?: "Active" | "Inactive";
  published?: boolean;
};