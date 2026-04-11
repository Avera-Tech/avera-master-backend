import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Tenant from './Tenant.model';

/**
 * GatewayCustomer — stores the tenant's token in the payment gateway.
 *
 * NEVER store raw card numbers, even encrypted (violates PCI-DSS).
 * The gateway (Asaas, Pagar.me, Stripe) tokenizes the card and returns
 * a customer_id. Only that token + display data is stored here.
 */

interface GatewayCustomerAttributes {
  id:                  number;
  tenant_id:           number;
  gateway:             string;
  gateway_customer_id: string;
  last_four_digits:    string | null;
  card_brand:          string | null;
  card_expiry:         string | null;
  createdAt?:          Date;
  updatedAt?:          Date;
}

type GatewayCustomerCreationAttributes = Optional<
  GatewayCustomerAttributes,
  'id' | 'last_four_digits' | 'card_brand' | 'card_expiry'
>;

class GatewayCustomer
  extends Model<GatewayCustomerAttributes, GatewayCustomerCreationAttributes>
  implements GatewayCustomerAttributes {
  declare id:                  number;
  declare tenant_id:           number;
  declare gateway:             string;
  declare gateway_customer_id: string;
  declare last_four_digits:    string | null;
  declare card_brand:          string | null;
  declare card_expiry:         string | null;
  declare readonly createdAt:  Date;
  declare readonly updatedAt:  Date;
}

GatewayCustomer.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
      onDelete: 'CASCADE',
    },
    gateway: {
      type: DataTypes.STRING(30),
      allowNull: false,
      comment: 'Gateway name: asaas, pagarme, stripe',
    },
    gateway_customer_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Customer ID from gateway — never store raw card data',
    },
    last_four_digits: {
      type: DataTypes.STRING(4),
      allowNull: true,
      defaultValue: null,
      comment: 'For display purposes only',
    },
    card_brand: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    card_expiry: {
      type: DataTypes.STRING(5),
      allowNull: true,
      defaultValue: null,
      comment: 'Format MM/YY — for display purposes only',
    },
  },
  {
    sequelize,
    tableName: 'gateway_customers',
    indexes: [
      { unique: true, fields: ['tenant_id', 'gateway'] },
    ],
  }
);

GatewayCustomer.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasOne(GatewayCustomer,   { foreignKey: 'tenant_id', as: 'gateway_customer' });

export default GatewayCustomer;