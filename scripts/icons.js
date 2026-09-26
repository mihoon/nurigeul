const fs=require('fs');const names=process.argv.slice(2);const out={};
for(const n of names){let s=fs.readFileSync(`node_modules/lucide-static/icons/${n}.svg`,'utf8');s=s.replace(/<!--.*?-->/gs,'').replace(/\s*class="[^"]*"/,'').replace(/width="24"/,'width="18"').replace(/height="24"/,'height="18"').replace(/\s+/g,' ').trim();out[n]=s;}
fs.writeFileSync('src/icons.js','window.ICONS='+JSON.stringify(out)+';\n');
