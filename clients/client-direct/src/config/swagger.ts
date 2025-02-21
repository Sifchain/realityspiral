import type { Application } from "express";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const filesPath = new URL("../", import.meta.url).pathname;

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
				url: process.env.UI_SERVER_URL || "http://localhost:3000", // Make sure this matches your running server
			},
		],
	},
	apis: [`${filesPath}**/*.ts`], // Path to API routes
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Application) => {
	app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
