export function parseListQuery(q) {
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? "10", 10) || 10));
    const rawSort = (q.sort ?? "").toString().trim();
    const sort = rawSort.length > 0 ? rawSort : "createdAt";
    const order = String(q.order ?? "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const search = (q.q ?? "").toString().trim();
    return { page, pageSize, sort, order, search };
}
