import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type TenantStatus  = 'pending' | 'active' | 'pending_provision' | 'suspended' | 'cancelled';
export type TenantPlan = string;
export type TenantSegment =
  | 'Academia'
  | 'Centro Esportivo'
  | 'Clube'
  | 'Escola de Esportes'
  | 'Quadras de Padel'
  | 'Quadras de Tênis'
  | 'Quadras de Beach Tennis'
  | 'Quadras de Futevôlei'
  | 'Centro Multiesportivo';

interface TenantAttributes {
  id:               number;
  cnpj:             string;
  company_name:     string;
  slug:             string;
  segment:          TenantSegment;
  city:             string;
  phone:            string | null;
  courts_count:     string;
  plan:             TenantPlan;
  status:           TenantStatus;
  trial_starts_at:  Date | null;
  trial_ends_at:    Date | null;
  db_name:          string | null;
  control_api_url:  string | null;
  createdAt?:       Date;
  updatedAt?:       Date;
}

type TenantCreationAttributes = Optional<
  TenantAttributes,
  'id' | 'status' | 'phone' | 'trial_starts_at' | 'trial_ends_at' | 'db_name' | 'control_api_url'
>;

class Tenant
  extends Model<TenantAttributes, TenantCreationAttributes>
  implements TenantAttributes {
  declare id:               number;
  declare cnpj:             string;
  declare company_name:     string;
  declare slug:             string;
  declare segment:          TenantSegment;
  declare city:             string;
  declare phone:            string | null;
  declare courts_count:     string;
  declare plan:             TenantPlan;
  declare status:           TenantStatus;
  declare trial_starts_at:  Date | null;
  declare trial_ends_at:    Date | null;
  declare db_name:          string | null;
  declare control_api_url:  string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Tenant.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    cnpj: {
      type: DataTypes.STRING(14),
      allowNull: false,
      unique: true,
    },
    company_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'URL-safe identifier. Ex: academia-exemplo → app.averafit.com.br/academia-exemplo',
    },
    segment: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    courts_count: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    plan: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'starter',
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'pending_provision', 'suspended', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    trial_starts_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    trial_ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    db_name: {
      type: DataTypes.STRING(60),
      allowNull: true,
      defaultValue: null,
      comment: 'Tenant database name. Ex: core_tenant_7',
    },
    control_api_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      comment: 'URL base da API do Control deste tenant. Ex: https://api.academia-exemplo.averafit.com.br',
    },
  },
  {
    sequelize,
    tableName: 'tenants',
  }
);

export default Tenant;