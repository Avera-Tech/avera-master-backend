import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Tenant from './Tenant.model';

/**
 * Feature — feature flags per tenant.
 *
 * Each record links a tenant to a feature and indicates if it is enabled.
 * Used by the Core backend to determine which modules a tenant can access.
 *
 * Feature name examples:
 *   'online_booking', 'student_management', 'basic_billing',
 *   'auto_reminders', 'financial_reports', 'wellhub_integration',
 *   'multi_units', 'dedicated_api'
 */

interface FeatureAttributes {
  id:           number;
  tenant_id:    number;
  feature_name: string;
  enabled:      boolean;
  createdAt?:   Date;
  updatedAt?:   Date;
}

type FeatureCreationAttributes = Optional<FeatureAttributes, 'id'>;

class Feature
  extends Model<FeatureAttributes, FeatureCreationAttributes>
  implements FeatureAttributes {
  declare id:           number;
  declare tenant_id:    number;
  declare feature_name: string;
  declare enabled:      boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Feature.init(
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
    feature_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Feature slug. Ex: financial_reports, wellhub_integration',
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'features',
    indexes: [
      { unique: true, fields: ['tenant_id', 'feature_name'] },
    ],
  }
);

Feature.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(Feature,  { foreignKey: 'tenant_id', as: 'features' });

export default Feature;