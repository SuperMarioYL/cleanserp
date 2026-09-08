import { build } from 'esbuild';
const bundled=await build({entryPoints:['src/content/rules.ts'],bundle:true,format:'esm',platform:'node',write:false});
const {classify}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const rows=[
 {title:'JavaScript reference',url:'https://developer.mozilla.org/en-US/docs/Web/JavaScript',snippet:'Reference documentation',source:'MDN'},
 {title:'一文读懂 5 个技巧',url:'https://baijiahao.baidu.com/s?id=demo',snippet:'建议收藏',source:'百家号'},
 {title:'Members article',url:'https://example.org/article',snippet:'登录查看全文',source:'Example'}
];
for(const r of rows) console.log(JSON.stringify({title:r.title,...classify({...r,engine:'baidu',node:null})}));
