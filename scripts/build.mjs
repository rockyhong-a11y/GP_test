import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist');
await Promise.all([cp('index.html','dist/index.html'),cp('src','dist/src',{recursive:true}),cp('public','dist',{recursive:true})]);
console.log('정적 사이트를 dist/에 빌드했습니다.');
