import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { db } from "#/db/index"

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [tanstackStartCookies()],
	trustedOrigins: process.env.BETTER_AUTH_URL
		? [process.env.BETTER_AUTH_URL]
		: ["http://localhost:3000"],
})
