import { execSync } from "node:child_process";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

const gitSha = (() => {
	try {
		return execSync("git rev-parse --short HEAD").toString().trim();
	} catch {
		return "unknown";
	}
})();

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
		__APP_COMMIT__: JSON.stringify(gitSha),
	},
	plugins: [
		devtools(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
