import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type TenantStatus = 'pending' | 'active' | 'suspended' | 'cancelled';
export type TenantPlan   = 'starter' | 'professional' | 'enterprise';
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
  id: number;
  cnpj: string;
  segment: TenantSegment;
  city: string;
  courts_count: string; // ex: "1 a 3", "4 a 8" …
  plan: TenantPlan;
  status: TenantStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

type TenantCreation = Optional<TenantAttributes, 'id' | 'status'>;

class Tenant extends Model<TenantAttributes, TenantCreation> implements TenantAttributes {
  declare id: number;
  declare cnpj: string;
  declare segment: TenantSegment;
  declare city: string;
  declare courts_count: string;
  declare plan: TenantPlan;
  declare status: TenantStatus;
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
      type: DataTypes.STRING(18),
      allowNull: false,
      unique: true,
    },
    segment: {
      type: DataTypes.STRING(60),
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    courts_count: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    plan: {
      type: DataTypes.ENUM('starter', 'professional', 'enterprise'),
      allowNull: false,
      defaultValue: 'starter',
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'suspended', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
  },
  {
    sequelize,
    tableName: 'tenants',
  }
);

export default Tenant;
