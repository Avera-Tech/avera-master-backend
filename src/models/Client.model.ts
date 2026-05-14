import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ClientAttributes {
  id:       number;
  name:     string;
  email:    string | null;
  phone:    string | null;
  company:  string | null;
  notes:    string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ClientCreationAttributes = Optional<
  ClientAttributes,
  'id' | 'email' | 'phone' | 'company' | 'notes'
>;

class Client
  extends Model<ClientAttributes, ClientCreationAttributes>
  implements ClientAttributes {
  declare id:       number;
  declare name:     string;
  declare email:    string | null;
  declare phone:    string | null;
  declare company:  string | null;
  declare notes:    string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Client.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      defaultValue: null,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
      defaultValue: null,
    },
    company: {
      type: DataTypes.STRING(150),
      allowNull: true,
      defaultValue: null,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'clients',
    indexes: [{ fields: ['name'] }],
  }
);

export default Client;
