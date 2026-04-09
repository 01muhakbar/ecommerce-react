'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = new Set(
      (Array.isArray(tables) ? tables : []).map((table) =>
        String(typeof table === 'string' ? table : table?.tableName || table?.table || '').toLowerCase()
      )
    );

    if (!normalizedTables.has('shipments')) {
      await queryInterface.createTable('shipments', {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        order_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'Orders',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        suborder_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          unique: true,
          references: {
            model: 'suborders',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        store_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'stores',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        seller_user_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        status: {
          type: Sequelize.ENUM(
            'WAITING_PAYMENT',
            'READY_TO_FULFILL',
            'PROCESSING',
            'PACKED',
            'SHIPPED',
            'IN_TRANSIT',
            'OUT_FOR_DELIVERY',
            'DELIVERED',
            'FAILED_DELIVERY',
            'RETURNED',
            'CANCELLED'
          ),
          allowNull: false,
          defaultValue: 'WAITING_PAYMENT',
        },
        courier_code: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        courier_service: {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
        tracking_number: {
          type: Sequelize.STRING(160),
          allowNull: true,
        },
        estimated_delivery: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        shipping_fee: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
        },
        shipping_address_snapshot: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        shipping_rate_snapshot: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('shipments', ['order_id'], {
        name: 'shipments_order_id_idx',
      });
      await queryInterface.addIndex('shipments', ['store_id'], {
        name: 'shipments_store_id_idx',
      });
      await queryInterface.addIndex('shipments', ['seller_user_id'], {
        name: 'shipments_seller_user_id_idx',
      });
      await queryInterface.addIndex('shipments', ['status'], {
        name: 'shipments_status_idx',
      });
      await queryInterface.addIndex('shipments', ['tracking_number'], {
        name: 'shipments_tracking_number_idx',
      });
    }

    if (!normalizedTables.has('tracking_events')) {
      await queryInterface.createTable('tracking_events', {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        shipment_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: 'shipments',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        event_type: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        event_label: {
          type: Sequelize.STRING(160),
          allowNull: true,
        },
        event_description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        occurred_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        source: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        actor_type: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        actor_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
        },
        metadata: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });

      await queryInterface.addIndex('tracking_events', ['shipment_id'], {
        name: 'tracking_events_shipment_id_idx',
      });
      await queryInterface.addIndex('tracking_events', ['occurred_at'], {
        name: 'tracking_events_occurred_at_idx',
      });
      await queryInterface.addIndex('tracking_events', ['event_type'], {
        name: 'tracking_events_event_type_idx',
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = new Set(
      (Array.isArray(tables) ? tables : []).map((table) =>
        String(typeof table === 'string' ? table : table?.tableName || table?.table || '').toLowerCase()
      )
    );

    if (normalizedTables.has('tracking_events')) {
      await queryInterface.dropTable('tracking_events');
    }

    if (normalizedTables.has('shipments')) {
      await queryInterface.dropTable('shipments');
    }
  },
};
