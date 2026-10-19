import { defineConfig } from 'vite';
export default defineConfig({build:{outDir:'dist/public'},server:{proxy:{'/socket.io':{target:'http://127.0.0.1:3000',ws:true},'/health':'http://127.0.0.1:3000'}}});
