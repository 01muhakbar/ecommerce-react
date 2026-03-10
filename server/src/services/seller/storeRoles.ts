import { StoreRole } from "../../models/StoreRole.js";
import { SYSTEM_SELLER_ROLES } from "./permissionMap.js";

export async function ensureSystemStoreRoles() {
  for (const role of SYSTEM_SELLER_ROLES) {
    const [record, created] = await StoreRole.findOrCreate({
      where: { code: role.code },
      defaults: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: true,
        isActive: true,
      },
    });

    if (
      !created &&
      (record.name !== role.name ||
        record.description !== role.description ||
        record.isSystem !== true ||
        record.isActive !== true)
    ) {
      await record.update({
        name: role.name,
        description: role.description,
        isSystem: true,
        isActive: true,
      });
    }
  }
}
