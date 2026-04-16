import { DataTypes, Model, Optional } from 'sequelize';
import { sequelizeMaster } from '../config/database';

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

interface InviteAttributes {
  id:           number;
  email:        string;
  nome:         string | null;
  token:        string;
  status:       InviteStatus;
  expires_at:   Date;
  created_by:   number; // AdminUser.id
  createdAt?:   Date;
  updatedAt?:   Date;
}

type InviteCreationAttributes = Optional<InviteAttributes, 'id' | 'status' | 'nome'>;

class Invite
  extends Model<InviteAttributes, InviteCreationAttributes>
  implements InviteAttributes {
  declare id:          number;
  declare email:       string;
  declare nome:        string | null;
  declare token:       string;
  declare status:      InviteStatus;
  declare expires_at:  Date;
  declare created_by:  number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Invite.init(
  {
    id: {
      type:          DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey:    true,
    },
    email: {
      type:      DataTypes.STRING(150),
      allowNull: false,
    },
    nome: {
      type:         DataTypes.STRING(150),
      allowNull:    true,
      defaultValue: null,
      comment:      'Name of the invited person (optional)',
    },
    token: {
      type:      DataTypes.STRING(64),
      allowNull: false,
      unique:    true,
      comment:   'Secure random token sent in the invite link',
    },
    status: {
      type:         DataTypes.ENUM('pending', 'accepted', 'expired', 'revoked'),
      allowNull:    false,
      defaultValue: 'pending',
    },
    expires_at: {
      type:      DataTypes.DATE,
      allowNull: false,
    },
    created_by: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment:   'AdminUser.id who sent the invite',
    },
  },
  {
    sequelize: sequelizeMaster,
    tableName: 'invites',
  }
);

export default Invite;
