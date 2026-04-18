import { Pool } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-serverless"

import * as authSchema from "./auth-schema.ts"
import * as schema from "./schema.ts"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const db = drizzle(pool, {
	schema: { ...schema, ...authSchema },
})
