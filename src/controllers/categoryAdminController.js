const { Category } = require('../models');

exports.renderManageCategoriesPage = async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.render('admin/manage-categories', { categories });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

exports.renderAddCategoryPage = (req, res) => {
  res.render('admin/add-category');
};

exports.addCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Nama kategori tidak boleh kosong' });
    }
    const newCategory = await Category.create({ name });
    res.status(201).json({ message: 'Kategori berhasil ditambahkan', category: newCategory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.renderEditCategoryPage = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).send('Kategori tidak ditemukan');
    }
    res.render('admin/edit-category', { category });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};

exports.editCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    }
    if (!name) {
      return res.status(400).json({ message: 'Nama kategori tidak boleh kosong' });
    }
    await category.update({ name });
    res.status(200).json({ message: 'Kategori berhasil diperbarui', category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    }
    await category.destroy();
    res.status(200).json({ message: 'Kategori berhasil dihapus' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
