import {mkdirSync,copyFileSync,cpSync} from 'node:fs';
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
copyFileSync('worker.mjs','dist/server/index.js');copyFileSync('validate.mjs','dist/server/validate.mjs');
copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');cpSync('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Prepared worker and database migrations.');
