import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express, Router } from "express";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "RealitySpiral API",
      version: "1.0.0",
      description: "API Documentation for RealitySpiral Project",
    },
    servers: [
      {
        url: process.env.UI_SERVER_URL
          ? `${process.env.UI_SERVER_URL}:${process.env.SERVER_PORT || "3000"}`
          : "http://localhost:3000", // Fallback if env variables are missing
      },
    ],
  },
  apis: ["./src/controllers/*.ts"], // Ensure it correctly points to your API files
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (router: Router) => {
  router.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
