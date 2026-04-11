import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

/**
 * AdminUser — Avera's internal admin users.
 * Completely separate from tenant Users.
 * Only Avera team members are stored here.
 */

interface AdminUserAttributes {
  id:         number;
  name:       string;
  email:      string;
  password:   string;
  active:     boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type AdminUserCreationAttributes = Optional<AdminUserAttributes, 'id' | 'active'>;

class AdminUser
  extends Model<AdminUserAttributes, AdminUserCreationAttributes>
  implements AdminUserAttributes {
  declare id:       number;
  declare name:     string;
  declare email:    string;
  declare password: string;
  declare active:   boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

AdminUser.init(
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
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'admin_users',
  }
);

export default AdminUser;