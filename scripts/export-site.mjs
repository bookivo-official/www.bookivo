import {cp, mkdir, readdir, stat, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(process.argv[2] || join(source,'dist'));
await mkdir(output,{recursive:true});
if((await readdir(output)).length) throw Error('Choose an empty output folder.');
const publicFiles=['css','js','reader','images','downloads','sign in','Free calculater','assets','favicon.png','style.css','supabase-config.js'];
for(const file of await readdir(source)){
  if(!publicFiles.includes(file) && !/^(BOOK-(?:[1-9]|1[0-2])|[\w-]+\.html)$/.test(file))continue;
  if(file==='design-system.html') continue;
  await cp(join(source,file),join(output,file),{recursive:true,filter:p=>!/[\\/](?:dev|README\.md)$/.test(p)});
}
await writeFile(join(output,'.nojekyll'),'');
await stat(join(output,'BOOK-2','index.html'));
console.log('Static BOOKIVO storefront exported to '+output);

