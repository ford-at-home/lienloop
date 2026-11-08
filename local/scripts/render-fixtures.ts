import {readdir} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
const dir=resolve('public/fixtures');
for(const file of await readdir(dir))if(file.endsWith('.pdf'))execFileSync('pdftoppm',['-singlefile','-scale-to','1200','-png',resolve(dir,file),resolve(dir,basename(file,'.pdf'))],{stdio:'inherit'});
console.log('Rendered PDF images. The original fax PNG is already included in public/fixtures.');
