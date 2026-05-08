'use strict';

module.exports = {
  async up(queryInterface) {
    const tableName = 'cart_items';
    const indexes = await queryInterface.showIndex(tableName).catch(() => []);
    const hasCartIdIndex = indexes.some(
      (index) => index?.name === 'cart_items_cart_id_idx'
    );
    if (!hasCartIdIndex) {
      await queryInterface.addIndex(tableName, ['cart_id'], {
        name: 'cart_items_cart_id_idx',
      });
    }

    const legacyUniqueIndex = indexes.find(
      (index) =>
        index?.name === 'cart_items_cartId_ProductId_unique' ||
        (
          index?.unique === true &&
          Array.isArray(index?.fields) &&
          index.fields.map((field) => field?.attribute).join(',') === 'cart_id,product_id'
        )
    );

    if (legacyUniqueIndex?.name) {
      await queryInterface.removeIndex(tableName, legacyUniqueIndex.name);
    }

    const refreshedIndexes = await queryInterface.showIndex(tableName).catch(() => []);
    const hasVariantLookupIndex = refreshedIndexes.some(
      (index) => index?.name === 'cart_items_cart_product_variant_idx'
    );
    if (!hasVariantLookupIndex) {
      await queryInterface.addIndex(
        tableName,
        ['cart_id', 'product_id', 'variant_key'],
        {
          name: 'cart_items_cart_product_variant_idx',
        }
      );
    }
  },

  async down(queryInterface) {
    const tableName = 'cart_items';
    const indexes = await queryInterface.showIndex(tableName).catch(() => []);
    const hasVariantLookupIndex = indexes.some(
      (index) => index?.name === 'cart_items_cart_product_variant_idx'
    );
    if (hasVariantLookupIndex) {
      await queryInterface.removeIndex(tableName, 'cart_items_cart_product_variant_idx');
    }

    const hasLegacyUniqueIndex = indexes.some(
      (index) => index?.name === 'cart_items_cartId_ProductId_unique'
    );
    if (!hasLegacyUniqueIndex) {
      await queryInterface.addIndex(
        tableName,
        ['cart_id', 'product_id'],
        {
          name: 'cart_items_cartId_ProductId_unique',
          unique: true,
        }
      );
    }

    const refreshedIndexes = await queryInterface.showIndex(tableName).catch(() => []);
    const hasCartIdIndex = refreshedIndexes.some(
      (index) => index?.name === 'cart_items_cart_id_idx'
    );
    if (hasCartIdIndex) {
      await queryInterface.removeIndex(tableName, 'cart_items_cart_id_idx');
    }
  },
};
