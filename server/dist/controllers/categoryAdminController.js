"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.getCategoryById = exports.createCategory = exports.getAllCategories = void 0;
const index_1 = require("../models/index");
// [REFACTORED] Menggantikan renderManageCategoriesPage
const getAllCategories = async (req, res) => {
    try {
        const categories = await index_1.Category.findAll();
        res.status(200).json({ success: true, data: categories });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};
exports.getAllCategories = getAllCategories;
// [REFACTORED] Menggantikan addCategory
const createCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ message: 'Nama kategori tidak boleh kosong' });
            return;
        }
        const newCategory = await index_1.Category.create({ name });
        res.status(201).json({ message: 'Kategori berhasil ditambahkan', category: newCategory });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};
exports.createCategory = createCategory;
// [REFACTORED] Menggantikan renderEditCategoryPage
const getCategoryById = async (req, res) => {
    try {
        const category = await index_1.Category.findByPk(req.params.id);
        if (!category) {
            res.status(404).send('Kategori tidak ditemukan');
            return;
        }
        res.status(200).json({ success: true, data: category });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};
exports.getCategoryById = getCategoryById;
// [REFACTORED] Menggantikan editCategory
const updateCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const category = await index_1.Category.findByPk(req.params.id);
        if (!category) {
            res.status(404).json({ message: 'Kategori tidak ditemukan' });
            return;
        }
        if (!name) {
            res.status(400).json({ message: 'Nama kategori tidak boleh kosong' });
            return;
        }
        await category.update({ name });
        res.status(200).json({ message: 'Kategori berhasil diperbarui', category });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res) => {
    try {
        const category = await index_1.Category.findByPk(req.params.id);
        if (!category) {
            res.status(404).json({ message: 'Kategori tidak ditemukan' });
            return;
        }
        await category.destroy();
        res.status(200).json({ message: 'Kategori berhasil dihapus' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};
exports.deleteCategory = deleteCategory;
