import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type OtpPurpose = 'signup' | 'password_reset' | 'email_change';

interface OtpCodeAttributes {
  id: number;
  user_id: number;
  code_hash: string;
  purpose: OtpPurpose;
  attempts: number;
  expires_at: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type OtpCreation = Optional<OtpCodeAttributes, 'id' | 'attempts'>;

class OtpCode extends Model<OtpCodeAttributes, OtpCreation> implements OtpCodeAttributes {
  declare id: number;
  declare user_id: number;
  declare code_hash: string;
  declare purpose: OtpPurpose;
  declare attempts: number;
  declare expires_at: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

OtpCode.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    code_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    purpose: {
      type: DataTypes.ENUM('signup', 'password_reset', 'email_change'),
      allowNull: false,
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
    tableName: 'otp_codes',
  }
);

export default OtpCode;
