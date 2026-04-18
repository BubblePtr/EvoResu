import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import neon from "./neon-vite-plugin.ts"

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	build: {
		rollupOptions: {
			// diff-match-patch uses document/window and must never enter the Workers bundle
			external: ["diff-match-patch"],
		},
	},
	plugins: [
		devtools(),
		neon,
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
})

export default config
