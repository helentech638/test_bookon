// vite.config.ts
import { defineConfig } from "file:///F:/BookOn/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///F:/BookOn/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import tailwindcss from "file:///F:/BookOn/frontend/node_modules/tailwindcss/lib/index.js";
import autoprefixer from "file:///F:/BookOn/frontend/node_modules/autoprefixer/lib/autoprefixer.js";
import cssnano from "file:///F:/BookOn/frontend/node_modules/cssnano/src/index.js";
var __vite_injected_original_dirname = "F:\\BookOn\\frontend";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "@/components": path.resolve(__vite_injected_original_dirname, "./src/components"),
      "@/pages": path.resolve(__vite_injected_original_dirname, "./src/pages"),
      "@/hooks": path.resolve(__vite_injected_original_dirname, "./src/hooks"),
      "@/services": path.resolve(__vite_injected_original_dirname, "./src/services"),
      "@/utils": path.resolve(__vite_injected_original_dirname, "./src/utils"),
      "@/types": path.resolve(__vite_injected_original_dirname, "./src/types"),
      "@/assets": path.resolve(__vite_injected_original_dirname, "./src/assets")
    }
  },
  server: {
    port: 3001,
    host: true,
    open: true
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
          forms: ["formik", "yup", "react-hook-form"],
          ui: ["framer-motion", "lucide-react", "tailwind-merge"],
          utils: ["lodash", "date-fns", "uuid"]
        }
      }
    },
    chunkSizeWarningLimit: 1e3
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "stripe",
      "@stripe/stripe-js",
      "@stripe/react-stripe-js",
      "formik",
      "yup",
      "react-hook-form",
      "framer-motion",
      "lucide-react",
      "tailwind-merge",
      "lodash",
      "date-fns",
      "uuid"
    ]
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
        cssnano({
          preset: "default"
        })
      ]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJGOlxcXFxCb29rT25cXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkY6XFxcXEJvb2tPblxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRjovQm9va09uL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAndGFpbHdpbmRjc3MnXG5pbXBvcnQgYXV0b3ByZWZpeGVyIGZyb20gJ2F1dG9wcmVmaXhlcidcbmltcG9ydCBjc3NuYW5vIGZyb20gJ2Nzc25hbm8nXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcbiAgICAgICdAL2NvbXBvbmVudHMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvY29tcG9uZW50cycpLFxuICAgICAgJ0AvcGFnZXMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvcGFnZXMnKSxcbiAgICAgICdAL2hvb2tzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL2hvb2tzJyksXG4gICAgICAnQC9zZXJ2aWNlcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYy9zZXJ2aWNlcycpLFxuICAgICAgJ0AvdXRpbHMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvdXRpbHMnKSxcbiAgICAgICdAL3R5cGVzJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL3R5cGVzJyksXG4gICAgICAnQC9hc3NldHMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMvYXNzZXRzJyksXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMzAwMSxcbiAgICBob3N0OiB0cnVlLFxuICAgIG9wZW46IHRydWUsXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgc291cmNlbWFwOiB0cnVlLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICBtYW51YWxDaHVua3M6IHtcbiAgICAgICAgICB2ZW5kb3I6IFsncmVhY3QnLCAncmVhY3QtZG9tJ10sXG4gICAgICAgICAgcm91dGVyOiBbJ3JlYWN0LXJvdXRlci1kb20nXSxcbiAgICAgICAgICBmb3JtczogWydmb3JtaWsnLCAneXVwJywgJ3JlYWN0LWhvb2stZm9ybSddLFxuICAgICAgICAgIHVpOiBbJ2ZyYW1lci1tb3Rpb24nLCAnbHVjaWRlLXJlYWN0JywgJ3RhaWx3aW5kLW1lcmdlJ10sXG4gICAgICAgICAgdXRpbHM6IFsnbG9kYXNoJywgJ2RhdGUtZm5zJywgJ3V1aWQnXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFtcbiAgICAgICdyZWFjdCcsXG4gICAgICAncmVhY3QtZG9tJyxcbiAgICAgICdyZWFjdC1yb3V0ZXItZG9tJyxcbiAgICAgICdzdHJpcGUnLFxuICAgICAgJ0BzdHJpcGUvc3RyaXBlLWpzJyxcbiAgICAgICdAc3RyaXBlL3JlYWN0LXN0cmlwZS1qcycsXG4gICAgICAnZm9ybWlrJyxcbiAgICAgICd5dXAnLFxuICAgICAgJ3JlYWN0LWhvb2stZm9ybScsXG4gICAgICAnZnJhbWVyLW1vdGlvbicsXG4gICAgICAnbHVjaWRlLXJlYWN0JyxcbiAgICAgICd0YWlsd2luZC1tZXJnZScsXG4gICAgICAnbG9kYXNoJyxcbiAgICAgICdkYXRlLWZucycsXG4gICAgICAndXVpZCcsXG4gICAgXSxcbiAgfSxcbiAgY3NzOiB7XG4gICAgcG9zdGNzczoge1xuICAgICAgcGx1Z2luczogW1xuICAgICAgICB0YWlsd2luZGNzcyxcbiAgICAgICAgYXV0b3ByZWZpeGVyLFxuICAgICAgICBjc3NuYW5vKHtcbiAgICAgICAgICBwcmVzZXQ6ICdkZWZhdWx0JyxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0sXG4gIH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE4TyxTQUFTLG9CQUFvQjtBQUMzUSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sa0JBQWtCO0FBQ3pCLE9BQU8sYUFBYTtBQUxwQixJQUFNLG1DQUFtQztBQVF6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLE1BQ3BDLGdCQUFnQixLQUFLLFFBQVEsa0NBQVcsa0JBQWtCO0FBQUEsTUFDMUQsV0FBVyxLQUFLLFFBQVEsa0NBQVcsYUFBYTtBQUFBLE1BQ2hELFdBQVcsS0FBSyxRQUFRLGtDQUFXLGFBQWE7QUFBQSxNQUNoRCxjQUFjLEtBQUssUUFBUSxrQ0FBVyxnQkFBZ0I7QUFBQSxNQUN0RCxXQUFXLEtBQUssUUFBUSxrQ0FBVyxhQUFhO0FBQUEsTUFDaEQsV0FBVyxLQUFLLFFBQVEsa0NBQVcsYUFBYTtBQUFBLE1BQ2hELFlBQVksS0FBSyxRQUFRLGtDQUFXLGNBQWM7QUFBQSxJQUNwRDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUEsVUFDWixRQUFRLENBQUMsU0FBUyxXQUFXO0FBQUEsVUFDN0IsUUFBUSxDQUFDLGtCQUFrQjtBQUFBLFVBQzNCLE9BQU8sQ0FBQyxVQUFVLE9BQU8saUJBQWlCO0FBQUEsVUFDMUMsSUFBSSxDQUFDLGlCQUFpQixnQkFBZ0IsZ0JBQWdCO0FBQUEsVUFDdEQsT0FBTyxDQUFDLFVBQVUsWUFBWSxNQUFNO0FBQUEsUUFDdEM7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0EsdUJBQXVCO0FBQUEsRUFDekI7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFNBQVM7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsS0FBSztBQUFBLElBQ0gsU0FBUztBQUFBLE1BQ1AsU0FBUztBQUFBLFFBQ1A7QUFBQSxRQUNBO0FBQUEsUUFDQSxRQUFRO0FBQUEsVUFDTixRQUFRO0FBQUEsUUFDVixDQUFDO0FBQUEsTUFDSDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
