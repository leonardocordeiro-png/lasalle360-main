import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Guard plugin: blocks any VITE_SUPABASE_SERVICE_ROLE_KEY and scans bundle for the actual key value
const serviceRoleGuard = () => {
  return {
    name: "service-role-guard",
    apply: "build",
    buildStart() {
      const env = process.env || {};
      // Fail if someone prefixed the service role key with VITE_ (would expose to client)
      const hasPrefixedServiceRole = Object.keys(env).some(
        (k) => k.startsWith("VITE_") && k.includes("SUPABASE_SERVICE_ROLE_KEY")
      );
      if (hasPrefixedServiceRole) {
        throw new Error(
          "Security error: Found VITE_SUPABASE_SERVICE_ROLE_KEY. Never expose Supabase service_role key to the client."
        );
      }
      // Warn if SUPABASE_SERVICE_ROLE_KEY exists in env (allowed server-side),
      // reminding it must not be referenced by client code.
      if (env.SUPABASE_SERVICE_ROLE_KEY) {
        this.warn(
          "Security notice: SUPABASE_SERVICE_ROLE_KEY is defined in environment. Ensure it is used only in server-side code (Edge Functions) and never referenced in the frontend."
        );
      }
    },
    generateBundle(_options, bundle) {
      const key = process.env?.SUPABASE_SERVICE_ROLE_KEY;
      if (!key || key.length < 16) return;
      for (const [fileName, asset] of Object.entries(bundle)) {
        const code = (asset as any).code ?? (asset as any).source;
        if (typeof code === "string" && code.includes(key)) {
          throw new Error(
            `Security error: Supabase service_role key detected in built asset "${fileName}". Do not include this key anywhere in client code or env prefixed with VITE_.`
          );
        }
      }
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  // Only expose VITE_* env variables to the client
  envPrefix: "VITE_",
  plugins: [react(), mode === "development" && componentTagger(), serviceRoleGuard()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-toast"],
        },
      },
    },
  },
}));