const { randomUUID } = require('node:crypto');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return res.status(503).json({error:'Приём ответов пока настраивается. Пожалуйста, попробуйте позже.'});
  async function redis(command) {
    const r = await fetch(url, {method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command)});
    const data = await r.json();
    if (!r.ok || data.error) throw new Error('Storage unavailable');
    return data.result;
  }
  try {
    if (req.method === 'GET') {
      const entries = await redis(['HVALS','jubilee:2026:guests']);
      return res.status(200).json({guests:entries.map(x=>JSON.parse(x)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
    }
    if(req.method==='DELETE') {
      const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
      if(typeof body?.id!=='string' || !/^[a-f0-9-]{36}$/.test(body.id)) return res.status(400).json({error:'Некорректный идентификатор гостя.'});
      await redis(['HDEL','jubilee:2026:guests',body.id]);
      return res.status(200).json({ok:true});
    }
    if(req.method!=='POST') {res.setHeader('Allow','GET, POST, DELETE');return res.status(405).end();}
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(body?.website) return res.status(400).json({error:'Не удалось отправить ответ.'});
    const name=typeof body?.name==='string'?body.name.trim().replace(/\s+/g,' '):'';
    if(name.length<3 || name.length>120 || !['yes','no'].includes(body?.attendance)) return res.status(400).json({error:'Укажите имя и фамилию и выберите ответ.'});
    const id=typeof body.id==='string' && /^[a-f0-9-]{36}$/.test(body.id)?body.id:randomUUID();
    const ip=req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    const rateKey='jubilee:rate:'+ip;
    const count=await redis(['INCR',rateKey]);
    if(count===1) await redis(['EXPIRE',rateKey,60]);
    if(count>10) return res.status(429).json({error:'Слишком много попыток. Повторите через минуту.'});
    await redis(['HSET','jubilee:2026:guests',id,JSON.stringify({id,name,attendance:body.attendance,createdAt:new Date().toISOString()})]);
    return res.status(200).json({id});
  } catch {return res.status(500).json({error:'Не удалось сохранить ответ. Попробуйте ещё раз.'});}
};
