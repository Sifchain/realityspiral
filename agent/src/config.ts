import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file
// This will not override any existing environment variables from the shell
dotenv.config({
	path: path.resolve(__dirname, "../../.env"),
	override: false, // This ensures shell variables take precedence
});
