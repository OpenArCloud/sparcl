import { vitePlugin } from "@remcovaes/web-test-runner-vite-plugin";
process.env.NODE_ENV = "test";

export default {
  plugins: [vitePlugin()],
};
