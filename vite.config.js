import { defineConfig } from 'vite';
import path from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import glsl from 'vite-plugin-glsl';
import basicSsl from '@vitejs/plugin-basic-ssl';
import typescript from '@rollup/plugin-typescript';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [svelte(), glsl(), basicSsl(), typescript()],
    resolve: {
        alias: {
            '@src': path.resolve(__dirname, 'src'),
            '@components': path.resolve(__dirname, 'src/components'),
            '@core': path.resolve(__dirname, 'src/core'),
            '@public': path.resolve(__dirname, 'public'),
            '@shaders': path.resolve(__dirname, 'src/core/engines/ogl/shaders'),
            '@thirdparty': path.resolve(__dirname, 'src/third-party'),
            '@experiments': path.resolve(__dirname, 'src/experiments'),
        },
        extensions: ['.js', '.svelte'],
    },
});
