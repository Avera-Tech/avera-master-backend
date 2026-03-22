import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PendingOtpAttributes {
  id: number;
  email: string;
  code_hash: string;
  verified: boolean;
  attempts: number;
  expires_at: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type PendingOtpCreation = Optional<PendingOtpAttributes, 'id' | 'attempts' | 'verified'>;

class PendingOtp extends Model<PendingOtpAttributes, PendingOtpCreation>
  implements PendingOtpAttributes {
  declare id: number;
  declare email: string;
  declare code_hash: string;
  declare verified: boolean;
  declare attempts: number;
  declare expires_at: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

PendingOtp.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    code_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'pending_otps',
  }
);

export default PendingOtp;