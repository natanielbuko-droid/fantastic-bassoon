import { defineConfig } from "vite";

// Ścieżki względne, żeby build działał zarówno na GitHub Pages
// (pod /fantastic-bassoon/grawiton-deluxe/), jak i lokalnie.
export default defineConfig({
  base: "./",
});
