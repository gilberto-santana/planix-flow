// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::", // permite acesso na rede local
    port: 8080,
  },
  plugins: [
    react(), // usa react com SWC para melhor performance
    mode === "development" && componentTagger(), // só ativa o lovable-tagger no modo dev
  ].filter(Boolean), // remove valores falsos
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // permite usar @/ para importar do src/
    },
  },
  envPrefix: "VITE_", // opcional: explicita que só variáveis com VITE_ devem ser carregadas
}));
