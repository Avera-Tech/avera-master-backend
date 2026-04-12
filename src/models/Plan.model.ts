import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type PlanStatus = 'active' | 'inactive';

interface PlanAttributes {
  id:          number;
  name:        string;
  price:       number;
  trial_days:  number;
  description: string | null;
  status:      PlanStatus;
  createdAt?:  Date;
  updatedAt?:  Date;
}

type PlanCreationAttributes = Optional<PlanAttributes, 'id' | 'description' | 'status' | 'trial_days'>;

class Plan
  extends Model<PlanAttributes, PlanCreationAttributes>
  implements PlanAttributes {
  declare id:          number;
  declare name:        string;
  declare price:       number;
  declare trial_days:  number;
  declare description: string | null;
  declare status:      PlanStatus;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Plan.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    trial_days: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active',
    },
  },
  {
    sequelize,
    tableName: 'plans',
  }
);

export default Plan;