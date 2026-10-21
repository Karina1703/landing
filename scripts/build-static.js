const fs=require('node:fs');
fs.mkdirSync('dist',{recursive:true});
for(const file of ['index.html','guests.html'])fs.copyFileSync(file,'dist/'+file);
fs.cpSync('assets','dist/assets',{recursive:true});
