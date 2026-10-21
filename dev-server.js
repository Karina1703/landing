const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const dataFile=path.join(os.homedir(),'.landing-jubilee-guests.json');
// Local development storage. Production continues to use Redis through api/rsvp.js.
process.env.UPSTASH_REDIS_REST_URL='http://local-storage';
process.env.UPSTASH_REDIS_REST_TOKEN='local';
process.env.GUESTS_PASSWORD=process.env.GUESTS_PASSWORD||require('node:crypto').randomBytes(24).toString('hex');
let data={};try{data=JSON.parse(fs.readFileSync(dataFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const rates=new Map();
global.fetch=async(url,options)=>{
  const [cmd,key,...args]=JSON.parse(options.body);let result;
  if(cmd==='HSET'){data[args[0]]=args[1];fs.writeFileSync(dataFile+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(dataFile+'.tmp',dataFile);result=1}
  else if(cmd==='HDEL'){delete data[args[0]];fs.writeFileSync(dataFile+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(dataFile+'.tmp',dataFile);result=1}
  else if(cmd==='HVALS')result=Object.values(data);
  else if(cmd==='INCR'){const now=Date.now(),prev=rates.get(key);const v=prev&&prev.until>now?prev:{n:0,until:now+60000};result=++v.n;rates.set(key,v)}
  else result=1;
  return {ok:true,json:async()=>({result})};
};
const handler=require('./api/rsvp');
http.createServer(async(req,res)=>{
  if(req.url.split('?')[0]==='/api/rsvp'){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){res.writeHead(413);return res.end()}}
    try{req.body=body?JSON.parse(body):{};}catch{res.writeHead(400,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:'Некорректные данные формы.'}))}
    res.status=c=>{res.statusCode=c;return res};res.json=b=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(b))};return handler(req,res);
  }
  const name=req.url.split('?')[0];const allowed={'/':'index.html','/index.html':'index.html','/guests.html':'guests.html','/assets/rail-portrait.jpg':'assets/rail-portrait.jpg'};
  if(!allowed[name]){res.writeHead(404);return res.end('Not found')}
  res.setHeader('Content-Type',name.endsWith('.jpg')?'image/jpeg':'text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');fs.createReadStream(path.join(__dirname,allowed[name])).pipe(res);
}).listen(8765,'127.0.0.1',()=>console.log('Invitation server: http://localhost:8765'));
