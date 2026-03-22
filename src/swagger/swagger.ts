import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';

require('dotenv').config();

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Avera Backend API',
      version: '1.0.0',
      description: 'API de cadastro, autenticação e gestão de tenants da plataforma Avera',
    },
    servers: [
      {
        url: process.env.APP_URL || 'http://localhost:3100',
        description: 'Servidor local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

const swaggerSetup = (app: Application): void => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log('[SWAGGER] Documentação disponível em /api-docs');
};

export default swaggerSetup;
