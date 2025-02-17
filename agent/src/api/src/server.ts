import express from "express";
// import cors from "cors";
import dotenv from "dotenv";
import tracesRoutes from "./routes/tracesRoutes";
// import { setupSwagger } from "./config/swagger";
import templateRoutes from "./routes/templateRoutes";

dotenv.config();

// Initialize Express App
const app = express();
app.use(express.json());
// app.use(cors());

// Setup Routes

// Add the new route
app.use("/api/templates", templateRoutes);

app.use("/api/traces", tracesRoutes);

// Setup Swagger
// setupSwagger(app);

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`✅ Server running on ${process.env.BASE_URL}:${PORT}`);
    console.log(
        `📄 Swagger is available at ${process.env.BASE_URL}:${PORT}/api-docs`
    );
});
