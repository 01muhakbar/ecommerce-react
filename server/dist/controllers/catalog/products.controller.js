import { Op } from "sequelize";
import { Product, Category } from "../../models/index.js";
const asSingle = (v) => (Array.isArray(v) ? v[0] : v);
const toId = (v) => {
    const raw = asSingle(v);
    const id = typeof raw === "string" ? Number(raw) : Number(raw);
    return Number.isFinite(id) ? id : null;
};
const mapStatus = {
    selling: "active",
    soldout: "inactive",
};
const toModelStatus = (raw) => {
    if (!raw)
        return undefined;
    const key = raw.toLowerCase();
    if (key in mapStatus)
        return mapStatus[key];
    if (["active", "inactive", "draft"].includes(key))
        return key;
    return undefined;
};
import { ProductQuerySchema, ProductCreateSchema, ProductUpdateSchema, TogglePublishSchema, } from "../../schemas/catalog.js";
export async function listProducts(req, res) {
    const qp = ProductQuerySchema.parse(req.query);
    const qStatus = typeof req.query.status === "string" ? req.query.status : undefined;
    const status = toModelStatus(qStatus);
    const where = {};
    if (qp.q)
        where.name = { [Op.like]: `%${qp.q}%` };
    if (qp.categoryId)
        where.categoryId = qp.categoryId;
    if (status)
        where.status = status;
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, count } = await Product.findAndCountAll({
        where,
        include: [{ model: Category, as: "category", attributes: ["id", "name"] }],
        limit: qp.pageSize,
        offset,
        order: [[qp.sort, qp.order.toUpperCase()]],
    });
    return res.json({
        items: rows.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category?.name ?? "-",
            price: p.price,
            salePrice: p.salePrice,
            stock: p.stock,
            status: p.status,
            isPublished: p.isPublished,
            sku: p.sku,
        })),
        page: qp.page,
        pageSize: qp.pageSize,
        total: count,
    });
}
export async function getProduct(req, res) {
    const id = toId(req.params.id);
    if (id === null)
        return res.status(400).json({ message: "Invalid id" });
    const p = await Product.findByPk(id, {
        include: [{ model: Category, as: "category" }],
    });
    if (!p)
        return res.status(404).json({ message: "Not found" });
    return res.json(p);
}
export async function createProduct(req, res) {
    const body = ProductCreateSchema.parse(req.body);
    // whitelist known fields from the incoming body
    const { name, price, categoryId, description, stock, images, status: rawStatus, } = body;
    const newProduct = {
        name,
        slug: (name || "").toLowerCase().replace(/\s+/g, "-"),
        price,
        categoryId,
        description,
        stock,
        // images field may map to imagePaths in model — keep as-is if model supports it
        // map status to model enum
        status: toModelStatus(rawStatus) ?? "draft",
    };
    const p = await Product.create(newProduct);
    res.status(201).json(p);
}
export async function updateProduct(req, res) {
    const body = ProductUpdateSchema.parse(req.body);
    const id = toId(req.params.id);
    if (id === null)
        return res.status(400).json({ message: "Invalid id" });
    const p = await Product.findByPk(id);
    if (!p)
        return res.status(404).json({ message: "Not found" });
    // whitelist update fields
    const { name, price, categoryId, description, stock, status: rawStatus, } = body;
    const updatePayload = {};
    if (name !== undefined)
        updatePayload.name = name;
    if (price !== undefined)
        updatePayload.price = price;
    if (categoryId !== undefined)
        updatePayload.categoryId = categoryId;
    if (description !== undefined)
        updatePayload.description = description;
    if (stock !== undefined)
        updatePayload.stock = stock;
    if (rawStatus !== undefined)
        updatePayload.status = toModelStatus(rawStatus) ?? updatePayload.status;
    await p.update(updatePayload);
    res.json(p);
}
export async function deleteProduct(req, res) {
    const id = toId(req.params.id);
    if (id === null)
        return res.status(400).json({ message: "Invalid id" });
    const p = await Product.findByPk(id);
    if (!p)
        return res.status(404).json({ message: "Not found" });
    await p.destroy();
    res.status(204).end();
}
export async function togglePublish(req, res) {
    const { published } = TogglePublishSchema.parse(req.body);
    const id = toId(req.params.id);
    if (id === null)
        return res.status(400).json({ message: "Invalid id" });
    const p = await Product.findByPk(id);
    if (!p)
        return res.status(404).json({ message: "Not found" });
    await p.update({ isPublished: published });
    res.json({ id: p.id, isPublished: p.isPublished });
}
export async function changeStatus(req, res) {
    const { status } = req.body;
    const id = toId(req.params.id);
    if (id === null)
        return res.status(400).json({ message: "Invalid id" });
    const p = await Product.findByPk(id);
    if (!p)
        return res.status(404).json({ message: "Not found" });
    const normalized = toModelStatus(status);
    if (!normalized)
        return res.status(400).json({ message: `Invalid status value: ${status}` });
    await p.update({ status: normalized });
    res.json({ id: p.id, status: p.status });
}
