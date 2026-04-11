import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type UserRole = 'admin' | 'member';

interface UserAttributes {
  id: number;
  tenant_id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  active: 0 | 1;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserCreation = Optional<UserAttributes, 'id' | 'role' | 'active'>;

class User extends Model<UserAttributes, UserCreation> implements UserAttributes {
  declare id: number;
  declare tenant_id: number;
  declare name: string;
  declare email: string;
  declare phone: string;
  declare role: UserRole;
  declare active: 0 | 1;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'member'),
      allowNull: false,
      defaultValue: 'admin',
    },
    active: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'users',
  }
);

export default User;
