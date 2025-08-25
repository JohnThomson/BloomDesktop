/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import pugPlugin from "vite-plugin-pug";

export default defineConfig({
    plugins: [react(), pugPlugin()],
    test: {
        setupFiles: ["./vitest.setup.ts"],
        include: ["./**/*{test,spec,Spec}.{js,ts,jsx,tsx}"],
        // various things copilot suggested to match vite config to webpack.
        // For now, they didn't help and some broke things.
        environment: "jsdom",
        globals: false,
        // Uncomment and adjust as needed to match your test file patterns:
        // include: ["./src/**/talkingBookSpec.ts"],
        // deps: {
        //     inline: [
        //         // Add packages here that should not be externalized
        //         "xregexp"
        //     ]
        // }
        deps: {
            inline: [
                "vitest-canvas-mock"
                //"bookEdit/toolbox/readers/libSynphony/synphony_lib.js"
            ]
        },
        browser: {
            enabled: true,
            name: "chromium"
            //provider: "playwright"
        },
        // For this config, check https://github.com/vitest-dev/vitest/issues/740
        //threads: false,
        environmentOptions: {
            jsdom: {
                resources: "usable"
            }
        }
    },
    // resolve: {
    //     alias: {
    //         // Add aliases to match webpack's resolve.alias if needed
    //         "@": resolve(__dirname, "src")
    //         // Example: "jquery": resolve(__dirname, "node_modules/jquery/dist/jquery.js")
    //     }
    // },
    define: {
        // Add global constants here if your webpack config defines any
        // Example: __DEV__: JSON.stringify(true)
    }
    // ...other options as needed to match your webpack config...
});
