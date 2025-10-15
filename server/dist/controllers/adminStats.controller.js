import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import tz from "dayjs/plugin/timezone.js";
import { Op } from "sequelize";
import { Order } from "../models/Order.js";
dayjs.extend(utc);
dayjs.extend(tz);
// Adapted to match the Order model statuses
const PAID_STATUSES = ["completed"];
export async function getAdminStats(req, res) {
    try {
        const zone = "Asia/Makassar"; // Or your server's timezone
        const now = dayjs().tz(zone);
        const startToday = now.startOf("day").toDate();
        const endToday = now.endOf("day").toDate();
        const startYest = now.subtract(1, "day").startOf("day").toDate();
        const endYest = now.subtract(1, "day").endOf("day").toDate();
        const startThisMonth = now.startOf("month").toDate();
        const endThisMonth = now.endOf("month").toDate();
        const startLastMonth = now.subtract(1, "month").startOf("month").toDate();
        const endLastMonth = now.subtract(1, "month").endOf("month").toDate();
        const sumInRange = async (start, end) => {
            const result = await Order.sum("totalAmount", {
                where: {
                    status: PAID_STATUSES,
                    createdAt: { [Op.between]: [start, end] },
                },
            });
            return Number(result || 0);
        };
        const [todayOrdersAmount, yesterdayOrdersAmount, thisMonthAmount, lastMonthAmount, allTimeAmount] = await Promise.all([
            sumInRange(startToday, endToday),
            sumInRange(startYest, endYest),
            sumInRange(startThisMonth, endThisMonth),
            sumInRange(startLastMonth, endLastMonth),
            Order.sum("totalAmount", { where: { status: PAID_STATUSES } }).then(n => Number(n || 0)),
        ]);
        // Adapted to match the Order model statuses
        const [totalOrders, ordersPending, ordersProcessing, ordersDelivered] = await Promise.all([
            Order.count(),
            Order.count({ where: { status: "pending" } }),
            Order.count({ where: { status: "processing" } }),
            Order.count({ where: { status: "completed" } }), // Mapped delivered to completed
        ]);
        return res.json({
            todayOrdersAmount,
            yesterdayOrdersAmount,
            thisMonthAmount,
            lastMonthAmount,
            allTimeAmount,
            totalOrders,
            ordersPending,
            ordersProcessing,
            ordersDelivered,
            currency: "IDR",
        });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Failed to compute stats" });
    }
}
