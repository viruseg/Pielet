// vite.config.js
import { defineConfig } from "file:///C:/Users/virus/OneDrive/Desktop/Pielet/node_modules/vite/dist/node/index.js";
var vite_config_default = defineConfig({
  build: {
    lib: {
      entry: "src/index.js",
      formats: ["es"],
      fileName: () => "pielet.js"
    },
    cssFileName: "pielet",
    emptyOutDir: true,
    target: "es2022"
  },
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx2aXJ1c1xcXFxPbmVEcml2ZVxcXFxEZXNrdG9wXFxcXFBpZWxldFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcdmlydXNcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxQaWVsZXRcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3ZpcnVzL09uZURyaXZlL0Rlc2t0b3AvUGllbGV0L3ZpdGUuY29uZmlnLmpzXCI7Ly8vIDxyZWZlcmVuY2UgdHlwZXM9XCJ2aXRlc3QvY29uZmlnXCIgLz5cbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBidWlsZDoge1xuICAgIGxpYjoge1xuICAgICAgZW50cnk6ICdzcmMvaW5kZXguanMnLFxuICAgICAgZm9ybWF0czogWydlcyddLFxuICAgICAgZmlsZU5hbWU6ICgpID0+ICdwaWVsZXQuanMnXG4gICAgfSxcbiAgICBjc3NGaWxlTmFtZTogJ3BpZWxldCcsXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXG4gICAgdGFyZ2V0OiAnZXMyMDIyJ1xuICB9LFxuICB0ZXN0OiB7XG4gICAgaW5jbHVkZTogWyd0ZXN0cy8qKi8qLnRlc3QuanMnXSxcbiAgICBlbnZpcm9ubWVudDogJ25vZGUnXG4gIH1cbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxTQUFTLG9CQUFvQjtBQUU3QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixPQUFPO0FBQUEsSUFDTCxLQUFLO0FBQUEsTUFDSCxPQUFPO0FBQUEsTUFDUCxTQUFTLENBQUMsSUFBSTtBQUFBLE1BQ2QsVUFBVSxNQUFNO0FBQUEsSUFDbEI7QUFBQSxJQUNBLGFBQWE7QUFBQSxJQUNiLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxFQUNWO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixTQUFTLENBQUMsb0JBQW9CO0FBQUEsSUFDOUIsYUFBYTtBQUFBLEVBQ2Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
