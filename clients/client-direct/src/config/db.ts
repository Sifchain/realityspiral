import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;


dotenv.config();

export const db = new Pool({
    connectionString:
        process.env.POSTGRES_URL ||
        "postgresql://softwareengineer-frontend@localhost:5432/tracing_database",
});

db.connect()
    .then(() => console.log("✅ Connected to PostgreSQL"))
    .catch((err) => console.error("❌ PostgreSQL Connection Error:", err));
