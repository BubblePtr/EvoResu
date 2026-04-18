import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import * as authSchema from "./auth-schema.ts"
import * as schema from "./schema.ts"

export const db = drizzle(neon(process.env.DATABASE_URL!), {
	schema: { ...schema, ...authSchema },
})
