import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Tenant from './Tenant.model';

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type PaymentMethod = 'credit_card' | 'debit_card' | 'pix' | 'bank_slip' | 'bank_transfer';

interface PaymentAttributes {
  id:             number;
  tenant_id:      number;
  paid_at:        Date | null;
  due_date:       Date;
  amount:         number;
  status:         PaymentStatus;
  payment_method: PaymentMethod | null;
  gateway_id:     string | null;
  description:    string | null;
  createdAt?:     Date;
  updatedAt?:     Date;
}

type PaymentCreationAttributes = Optional<
  PaymentAttributes,
  'id' | 'paid_at' | 'payment_method' | 'gateway_id' | 'description'
>;

class Payment
  extends Model<PaymentAttributes, PaymentCreationAttributes>
  implements PaymentAttributes {
  declare id:             number;
  declare tenant_id:      number;
  declare paid_at:        Date | null;
  declare due_date:       Date;
  declare amount:         number;
  declare status:         PaymentStatus;
  declare payment_method: PaymentMethod | null;
  declare gateway_id:     string | null;
  declare description:    string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Payment.init(
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
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'overdue', 'cancelled', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
    },
    payment_method: {
      type: DataTypes.ENUM('credit_card', 'debit_card', 'pix', 'bank_slip', 'bank_transfer'),
      allowNull: true,
      defaultValue: null,
    },
    gateway_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
      comment: 'Transaction ID from payment gateway (Asaas, Pagar.me, etc.)',
    },
    description: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'payments',
    indexes: [
      { fields: ['tenant_id'] },
      { fields: ['status'] },
      { fields: ['due_date'] },
    ],
  }
);

Payment.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(Payment,  { foreignKey: 'tenant_id', as: 'payments' });

export default Payment;