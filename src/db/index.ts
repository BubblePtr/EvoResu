import { drizzle } from "drizzle-orm/node-postgres"

import * as authSchema from "./auth-schema.ts"
import * as schema from "./schema.ts"

export const db = drizzle(process.env.DATABASE_URL!, {
	schema: { ...schema, ...authSchema },
})
