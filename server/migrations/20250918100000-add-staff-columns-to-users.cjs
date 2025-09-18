import { QueryInterface, DataTypes } from 'sequelize';

export = {
  up: async (queryInterface: QueryInterface) => {
    // Tambah kolom is_published jika belum ada
    await queryInterface.addColumn('Users', 'is_published', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    // Ubah definisi enum untuk kolom role
    await queryInterface.changeColumn('Users', 'role', {
      type: DataTypes.ENUM(
        'Super Admin',
        'Admin',
        'Cashier',
        'CEO',
        'Manager',
        'Accountant',
        'Driver',
        'Security Guard',
        'Delivery Person',
        'user', // Pastikan role lama tetap ada
        'seller' // Pastikan role lama tetap ada
      ),
      allowNull: false,
    });
  },

  down: async (queryInterface: QueryInterface) => {
    // Kembalikan definisi enum role ke versi sebelumnya
    await queryInterface.changeColumn('Users', 'role', {
        type: DataTypes.ENUM('user', 'admin', 'seller'),
        allowNull: false,
    });

    // Hapus kolom is_published
    await queryInterface.removeColumn('Users', 'is_published');
  },
};
