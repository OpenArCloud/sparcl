import { defineConfig } from 'vite';
import path from 'path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import glsl from 'vite-plugin-glsl';
import basicSsl from '@vitejs/plugin-basic-ssl';
import wasm from 'vite-plugin-wasm';
import typescript from '@rollup/plugin-typescript';

// https://vitejs.dev/config/
export default defineConfig({
    build: {
        target: 'esnext',
    },
    plugins: [
        svelte(),
        glsl(),
        //basicSsl(),
        typescript(),
        wasm(),
    ],
    resolve: {
        alias: {
            '@src': path.resolve(__dirname, 'src'),
            '@components': path.resolve(__dirname, 'src/components'),
            '@core': path.resolve(__dirname, 'src/core'),
            '@public': path.resolve(__dirname, 'public'),
            '@shaders': path.resolve(__dirname, 'src/core/engines/ogl/shaders'),
            '@thirdparty': path.resolve(__dirname, 'src/third-party'),
            '@types': path.resolve(__dirname, 'src/types'),
            '@experiments': path.resolve(__dirname, 'src/experiments'),
        },
        extensions: ['.js', '.svelte'],
    },
});
