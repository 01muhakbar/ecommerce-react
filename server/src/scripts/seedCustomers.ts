import "dotenv/config";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { User, sequelize } from "../models/index.ts";

const PASSWORD = "customer123";
const TOTAL = 12;
const ROLE = "customer";

function buildDemoCustomers() {
  const customers = [];
  for (let i = 1; i <= TOTAL; i += 1) {
    const index = String(i).padStart(2, "0");
    customers.push({
      name: `Customer ${i}`,
      email: `customer${index}@local.dev`,
      phone_number: `08123${index}000`,
    });
  }
  return customers;
}

async function seedCustomers() {
  await sequelize.authenticate();

  const demo = buildDemoCustomers();
  const emails = demo.map((c) => c.email);

  const existing = await User.findAll({ where: { email: { [Op.in]: emails } } });
  const existingSet = new Set(existing.map((u: any) => u.email));

  const hash = await bcrypt.hash(PASSWORD, 10);
  const toCreate = demo
    .filter((c) => !existingSet.has(c.email))
    .map((c) => ({
      name: c.name,
      email: c.email,
      password: hash,
      role: ROLE,
      status: "active",
      phone_number: c.phone_number,
    } as any));

  if (toCreate.length > 0) {
    await User.bulkCreate(toCreate);
  }

  const created = toCreate.length;
  const skipped = demo.length - created;

  console.log(`[seed:customers] Created: ${created}, Skipped: ${skipped}`);
}

seedCustomers()
  .catch((error) => {
    console.error("[seed:customers] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });