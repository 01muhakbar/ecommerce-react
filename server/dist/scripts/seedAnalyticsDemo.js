import { Op } from "sequelize";
import { sequelize, User, Product, Order, OrderItem } from "../models/index.js";
const DEMO_PREFIX = "demo-";
const SELLER_EMAIL = "demo-seller@example.com";
const CUSTOMER_EMAILS = [
    "demo-customer1@example.com",
    "demo-customer2@example.com",
    "demo-customer3@example.com",
];
const PRODUCTS = [
    { name: "Demo T-Shirt", slug: "demo-tshirt", price: 150000 },
    { name: "Demo Sneakers", slug: "demo-sneakers", price: 450000 },
    { name: "Demo Backpack", slug: "demo-backpack", price: 220000 },
    { name: "Demo Hoodie", slug: "demo-hoodie", price: 320000 },
    { name: "Demo Watch", slug: "demo-watch", price: 680000 },
];
const STATUSES = [
    "processing",
    "pending",
    "completed",
    "delivered",
    "cancelled",
];
const toOrderDate = (daysAgo, hour) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, 15, 0, 0);
    return date;
};
async function seedAnalyticsDemo() {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();
    const orderItemTable = await queryInterface.describeTable("OrderItems");
    const orderItemFields = {
        orderId: orderItemTable.order_id ? "order_id" : "orderId",
        productId: orderItemTable.product_id ? "product_id" : "productId",
        createdAt: orderItemTable.created_at ? "created_at" : "createdAt",
        updatedAt: orderItemTable.updated_at ? "updated_at" : "updatedAt",
    };
    const transaction = await sequelize.transaction();
    try {
        const demoUsers = await User.findAll({
            where: { email: { [Op.in]: [...CUSTOMER_EMAILS, SELLER_EMAIL] } },
            attributes: ["id"],
            transaction,
        });
        const demoUserIds = demoUsers.map((user) => user.id);
        const demoOrders = demoUserIds.length
            ? await Order.findAll({
                where: { userId: { [Op.in]: demoUserIds } },
                attributes: ["id"],
                transaction,
            })
            : [];
        const demoOrderIds = demoOrders.map((order) => order.id);
        if (demoOrderIds.length) {
            await OrderItem.destroy({
                where: { orderId: demoOrderIds },
                transaction,
            });
            await Order.destroy({
                where: { id: demoOrderIds },
                transaction,
            });
        }
        await Product.destroy({
            where: { slug: { [Op.like]: `${DEMO_PREFIX}%` } },
            transaction,
        });
        await User.destroy({
            where: { email: { [Op.in]: [...CUSTOMER_EMAILS, SELLER_EMAIL] } },
            transaction,
        });
        const [seller] = await User.findOrCreate({
            where: { email: SELLER_EMAIL },
            defaults: {
                name: "Demo Seller",
                email: SELLER_EMAIL,
                password: "demo",
                role: "staff",
                status: "active",
            },
            transaction,
        });
        const customers = [];
        for (const email of CUSTOMER_EMAILS) {
            const [customer] = await User.findOrCreate({
                where: { email },
                defaults: {
                    name: email.split("@")[0].replace("demo-", "Demo "),
                    email,
                    password: "demo",
                    role: "user",
                    status: "active",
                },
                transaction,
            });
            customers.push(customer);
        }
        const createdProducts = [];
        for (const product of PRODUCTS) {
            const created = await Product.create({
                name: product.name,
                slug: product.slug,
                price: product.price,
                stock: 200,
                userId: seller.id,
                status: "active",
                isPublished: true,
            }, { transaction });
            createdProducts.push(created);
        }
        for (let day = 0; day < 7; day += 1) {
            for (let i = 0; i < 2; i += 1) {
                const createdAt = toOrderDate(day, 9 + i * 3);
                const status = STATUSES[(day + i) % STATUSES.length];
                const customer = customers[(day + i) % customers.length];
                let totalAmount = 0;
                const order = await Order.create({
                    invoiceNo: `${DEMO_PREFIX}${createdAt.getTime()}-${day}${i}`,
                    userId: customer.id,
                    status: status,
                    totalAmount: 0,
                    createdAt,
                    updatedAt: createdAt,
                }, { transaction });
                const productA = createdProducts[(day + i) % createdProducts.length];
                const productB = createdProducts[(day + i + 2) % createdProducts.length];
                const items = [
                    { product: productA, qty: 1 + ((day + i) % 3) },
                    { product: productB, qty: 1 + ((day + i + 1) % 2) },
                ];
                for (const item of items) {
                    const lineTotal = item.qty * Number(item.product.price);
                    totalAmount += lineTotal;
                    await queryInterface.bulkInsert(OrderItem.getTableName(), [
                        {
                            [orderItemFields.orderId]: order.id,
                            [orderItemFields.productId]: item.product.id,
                            quantity: item.qty,
                            price: item.product.price,
                            [orderItemFields.createdAt]: createdAt,
                            [orderItemFields.updatedAt]: createdAt,
                        },
                    ], { transaction });
                }
                order.totalAmount = totalAmount;
                await order.save({ transaction });
            }
        }
        await transaction.commit();
        console.log("Analytics demo data seeded.");
    }
    catch (error) {
        await transaction.rollback();
        console.error("Failed to seed analytics demo data.", error);
        process.exitCode = 1;
    }
    finally {
        await sequelize.close();
    }
}
seedAnalyticsDemo();
