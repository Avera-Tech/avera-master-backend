# Avera Backend

Backend do fluxo de signup e autenticação da plataforma Avera.  
Construído com **Node.js + TypeScript + Express + Sequelize + MySQL**.

---

## Estrutura

```
avera-backend/
├── src/
│   ├── config/
│   │   └── database.ts          # Conexão Sequelize (MySQL)
│   ├── controllers/
│   │   ├── signupController.ts  # register · verifyOtp · resendOtp
│   │   └── authController.ts    # login · forgotPassword · resetPassword · me
│   ├── core/
│   │   ├── email/
│   │   │   ├── emailService.ts  # Nodemailer wrapper
│   │   │   └── otpService.ts    # Geração, hash e envio de OTP
│   │   └── token/
│   │       ├── generateAuthToken.ts
│   │       └── generateResetToken.ts
│   ├── middleware/
│   │   └── authenticateToken.ts # Guard JWT
│   ├── models/
│   │   ├── Tenant.model.ts      # Empresa cadastrada
│   │   ├── User.model.ts        # Admin/membro do tenant
│   │   └── OtpCode.model.ts     # Códigos OTP (signup, reset)
│   ├── routes/
│   │   ├── indexRoutes.ts       # GET /
│   │   ├── signupRoutes.ts      # POST /signup/*
│   │   └── authRoutes.ts        # POST /auth/*  GET /auth/me
│   ├── swagger/
│   │   └── swagger.ts
│   ├── types/
│   │   └── index.d.ts           # AuthTokenPayload + Express.Request augment
│   ├── app.ts
│   └── index.ts
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Endpoints

### Signup

| Método | Rota                   | Descrição                                              |
|--------|------------------------|--------------------------------------------------------|
| POST   | `/signup/register`     | Cria Tenant + User (pending) e envia OTP por e-mail    |
| POST   | `/signup/verify`       | Valida OTP → ativa conta → retorna JWT                 |
| POST   | `/signup/resend-otp`   | Reenvia código OTP para conta ainda pendente           |

### Auth

| Método | Rota                      | Descrição                                           |
|--------|---------------------------|-----------------------------------------------------|
| POST   | `/auth/login`             | Login com e-mail e senha → retorna JWT              |
| POST   | `/auth/forgot-password`   | Envia código OTP de recuperação de senha            |
| POST   | `/auth/reset-password`    | Valida OTP e aplica nova senha                      |
| GET    | `/auth/me`                | Retorna dados do usuário autenticado (Bearer token) |

---

## Setup

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# edite o .env com suas credenciais

# 3. Criar o banco de dados MySQL
# CREATE DATABASE avera_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 4. Rodar em desenvolvimento
npm start
```

### Sincronizar tabelas (primeira execução)

Adicione temporariamente ao final de `src/index.ts` após o `authenticate()`:

```ts
await sequelize.sync({ alter: true });
```

Remove após a primeira execução em produção.

---

## Variáveis de ambiente

| Variável          | Descrição                          |
|-------------------|------------------------------------|
| `DB_HOST`         | Host do MySQL                      |
| `DB_PORT`         | Porta (padrão: 3306)               |
| `DB_NAME`         | Nome do banco de dados             |
| `DB_USER`         | Usuário do banco                   |
| `DB_PASS`         | Senha do banco                     |
| `JWT_SECRET`      | Chave secreta para assinar JWTs    |
| `JWT_EXPIRES_IN`  | Expiração do token (ex: `24h`)     |
| `MAIL_HOST`       | Host SMTP                          |
| `MAIL_PORT`       | Porta SMTP (587 / 465)             |
| `MAIL_USER`       | Usuário SMTP                       |
| `MAIL_PASS`       | Senha / App Password               |
| `MAIL_FROM`       | Remetente padrão                   |
| `PORT`            | Porta HTTP (padrão: 3100)          |
| `APP_URL`         | URL base (para Swagger)            |

---

## Documentação interativa

Acesse `http://localhost:3100/api-docs` após iniciar o servidor.
