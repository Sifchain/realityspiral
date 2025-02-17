import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

export const db = new Pool({
    connectionString:
        process.env.POSTGRES_URL ||
        "postgresql://softwareengineer-frontend@localhost:5432/tracing_database",
});

db.connect()
    .then(() => console.log("✅ Connected to PostgreSQL"))
    .catch((err: any) => console.error("❌ PostgreSQL Connection Error:", err));
