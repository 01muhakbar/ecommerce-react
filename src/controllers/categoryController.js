const { Category } = require('../models');

exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({
        status: 'fail',
        message: 'Category name is required.',
      });
    }
    const newCategory = await Category.create({ name, description });
    res.status(201).json({
      status: 'success',
      data: {
        category: newCategory,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error creating category.',
      error: error.message,
    });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.status(200).json({
      status: 'success',
      results: categories.length,
      data: {
        categories,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error fetching categories.',
      error: error.message,
    });
  }
};
