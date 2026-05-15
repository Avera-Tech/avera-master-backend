import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SettingAttributes {
  key:         string;
  value:       string | null;
  description: string | null;
  createdAt?:  Date;
  updatedAt?:  Date;
}

type SettingCreationAttributes = Optional<SettingAttributes, 'value' | 'description'>;

class Setting
  extends Model<SettingAttributes, SettingCreationAttributes>
  implements SettingAttributes {
  declare key:         string;
  declare value:       string | null;
  declare description: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Setting.init(
  {
    key: {
      type:       DataTypes.STRING(100),
      primaryKey: true,
    },
    value: {
      type:         DataTypes.TEXT,
      allowNull:    true,
      defaultValue: null,
    },
    description: {
      type:         DataTypes.STRING(255),
      allowNull:    true,
      defaultValue: null,
    },
  },
  { sequelize, tableName: 'settings' }
);

export default Setting;
