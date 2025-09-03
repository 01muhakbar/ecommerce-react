"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllCategories = exports.createCategory = void 0;
const index_1 = require("../models/index");
const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            res.status(400).json({
                status: 'fail',
                message: 'Category name is required.',
            });
            return;
        }
        const newCategory = await index_1.Category.create({ name, description });
        res.status(201).json({
            status: 'success',
            data: {
                category: newCategory,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error creating category.',
            error: error.message,
        });
    }
};
exports.createCategory = createCategory;
const getAllCategories = async (req, res) => {
    try {
        const categories = await index_1.Category.findAll();
        res.status(200).json({
            status: 'success',
            results: categories.length,
            data: {
                categories,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Error fetching categories.',
            error: error.message,
        });
    }
};
exports.getAllCategories = getAllCategories;
