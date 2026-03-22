import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type UserRole = 'admin' | 'member';

interface UserAttributes {
  id: number;
  tenant_id: number;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  active: 0 | 1;
  reset_token?: string | null;
  reset_token_expires?: Date | null;
  token_version: number;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserCreation = Optional<
  UserAttributes,
  'id' | 'role' | 'active' | 'reset_token' | 'reset_token_expires' | 'token_version'
>;

class User extends Model<UserAttributes, UserCreation> implements UserAttributes {
  declare id: number;
  declare tenant_id: number;
  declare name: string;
  declare email: string;
  declare phone: string;
  declare password: string;
  declare role: UserRole;
  declare active: 0 | 1;
  declare reset_token: string | null;
  declare reset_token_expires: Date | null;
  declare token_version: number;
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
    password: {
      type: DataTypes.STRING(255),
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
    reset_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reset_token_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    token_version: {
      type: DataTypes.INTEGER,
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
