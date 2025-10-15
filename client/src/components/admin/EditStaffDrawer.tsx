import AddStaffDrawer from "./AddStaffDrawer";
import type { Staff } from "../../types/staff";

// Reuse AddStaffDrawer but pass defaultValues & a different mutation
export default function EditStaffDrawer({
  open,
  onClose,
  staff,
}: {
  open: boolean;
  onClose: () => void;
  staff: Staff | null;
}) {
  if (!staff) return null;
  return (
    <AddStaffDrawer
      open={open}
      onClose={onClose}
      editMode
      initialValues={{
        name: staff.name,
        email: staff.email,
        contactNumber: staff.contactNumber ?? "",
        joiningDate: staff.joiningDate ?? "",
        role: staff.role as any,
        routes: Array.isArray(staff.routes)
          ? staff.routes
          : typeof staff.routes === "string"
          ? [staff.routes]
          : [],
        // image left empty; backend keeps previous avatar if not sent
      }}
      staffId={staff.id}
    />
  );
}
