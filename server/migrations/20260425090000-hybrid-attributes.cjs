"use strict";

async function hasColumn(queryInterface, tableName, columnName) {
  try {
    const description = await queryInterface.describeTable(tableName);
    return Boolean(description?.[columnName]);
  } catch {
    return false;
  }
}

async function getUniqueIndexes(queryInterface, tableName) {
  const [rows] = await queryInterface.sequelize.query(`SHOW INDEX FROM \`${tableName}\``);
  const groups = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const keyName = String(row.Key_name || "");
    if (!keyName || keyName === "PRIMARY") return;
    const current = groups.get(keyName) || {
      nonUnique: Number(row.Non_unique || 0),
      columns: [],
    };
    current.columns.push({
      seq: Number(row.Seq_in_index || 0),
      name: String(row.Column_name || ""),
    });
    groups.set(keyName, current);
  });

  return Array.from(groups.entries()).map(([name, value]) => ({
    name,
    nonUnique: value.nonUnique,
    columns: value.columns.sort((a, b) => a.seq - b.seq).map((entry) => entry.name),
  }));
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;

    if (!(await hasColumn(qi, "attributes", "scope"))) {
      await qi.addColumn("attributes", "scope", {
        type: Sequelize.ENUM("global", "store"),
        allowNull: false,
        defaultValue: "global",
      });
    }

    if (!(await hasColumn(qi, "attributes", "store_id"))) {
      await qi.addColumn("attributes", "store_id", {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      });
    }

    if (!(await hasColumn(qi, "attributes", "created_by_role"))) {
      await qi.addColumn("attributes", "created_by_role", {
        type: Sequelize.ENUM("admin", "seller"),
        allowNull: false,
        defaultValue: "admin",
      });
    }

    if (!(await hasColumn(qi, "attributes", "created_by_user_id"))) {
      await qi.addColumn("attributes", "created_by_user_id", {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      });
    }

    if (!(await hasColumn(qi, "attributes", "status"))) {
      await qi.addColumn("attributes", "status", {
        type: Sequelize.ENUM("active", "archived"),
        allowNull: false,
        defaultValue: "active",
      });
    }

    if (!(await hasColumn(qi, "attribute_values", "status"))) {
      await qi.addColumn("attribute_values", "status", {
        type: Sequelize.ENUM("active", "archived"),
        allowNull: false,
        defaultValue: "active",
      });
    }

    await qi.sequelize.query(`
      UPDATE attributes
      SET
        scope = COALESCE(scope, 'global'),
        store_id = NULL,
        created_by_role = COALESCE(created_by_role, 'admin'),
        status = COALESCE(status, 'active')
    `);

    await qi.sequelize.query(`
      UPDATE attribute_values
      SET status = COALESCE(status, 'active')
    `);

    const indexes = await getUniqueIndexes(qi, "attributes");
    for (const index of indexes) {
      if (index.nonUnique === 0 && index.columns.length === 1 && index.columns[0] === "name") {
        await qi.removeIndex("attributes", index.name);
      }
    }

    if (!(await hasColumn(qi, "attributes", "scope_store_key"))) {
      await qi.sequelize.query(`
        ALTER TABLE attributes
        ADD COLUMN scope_store_key INT
          GENERATED ALWAYS AS (
            CASE
              WHEN scope = 'global' THEN 0
              ELSE IFNULL(store_id, 0)
            END
          ) STORED
      `);
    }

    const refreshedIndexes = await getUniqueIndexes(qi, "attributes");
    const hasScopeStoreUnique = refreshedIndexes.some(
      (index) =>
        index.nonUnique === 0 &&
        index.columns.join(",") === "scope_store_key,name"
    );
    if (!hasScopeStoreUnique) {
      await qi.addIndex("attributes", ["scope_store_key", "name"], {
        unique: true,
        name: "uq_attributes_scope_store_name",
      });
    }

    const hasScopeFilterIndex = refreshedIndexes.some(
      (index) => index.columns.join(",") === "scope,status,published"
    );
    if (!hasScopeFilterIndex) {
      await qi.addIndex("attributes", ["scope", "status", "published"], {
        name: "idx_attributes_scope_status_published",
      });
    }

    const hasStoreIndex = refreshedIndexes.some(
      (index) => index.columns.join(",") === "store_id,scope,status"
    );
    if (!hasStoreIndex) {
      await qi.addIndex("attributes", ["store_id", "scope", "status"], {
        name: "idx_attributes_store_scope_status",
      });
    }

    const valueIndexes = await getUniqueIndexes(qi, "attribute_values");
    const hasAttributeValueIndex = valueIndexes.some(
      (index) => index.columns.join(",") === "attribute_id,status"
    );
    if (!hasAttributeValueIndex) {
      await qi.addIndex("attribute_values", ["attribute_id", "status"], {
        name: "idx_attribute_values_attribute_status",
      });
    }
  },

  async down(queryInterface) {
    const qi = queryInterface;

    const safeRemoveIndex = async (tableName, indexName) => {
      try {
        await qi.removeIndex(tableName, indexName);
      } catch {
        // ignore missing index
      }
    };

    await safeRemoveIndex("attribute_values", "idx_attribute_values_attribute_status");
    await safeRemoveIndex("attributes", "idx_attributes_store_scope_status");
    await safeRemoveIndex("attributes", "idx_attributes_scope_status_published");
    await safeRemoveIndex("attributes", "uq_attributes_scope_store_name");

    if (await hasColumn(qi, "attributes", "scope_store_key")) {
      await qi.removeColumn("attributes", "scope_store_key");
    }
    if (await hasColumn(qi, "attribute_values", "status")) {
      await qi.removeColumn("attribute_values", "status");
    }
    if (await hasColumn(qi, "attributes", "status")) {
      await qi.removeColumn("attributes", "status");
    }
    if (await hasColumn(qi, "attributes", "created_by_user_id")) {
      await qi.removeColumn("attributes", "created_by_user_id");
    }
    if (await hasColumn(qi, "attributes", "created_by_role")) {
      await qi.removeColumn("attributes", "created_by_role");
    }
    if (await hasColumn(qi, "attributes", "store_id")) {
      await qi.removeColumn("attributes", "store_id");
    }
    if (await hasColumn(qi, "attributes", "scope")) {
      await qi.removeColumn("attributes", "scope");
    }
  },
};
