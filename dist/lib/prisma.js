import dotenv from "dotenv";
dotenv.config(); // ← load env FIRST before reading DATABASE_URL
import { createRequire } from "node:module";
import { PrismaPg } from "@prisma/adapter-pg";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("./generated/prisma");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in environment variables");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
export { prisma };
