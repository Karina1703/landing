const rsvp = require('../../api/rsvp');
exports.handler = async function(event) {
  let body;
  try { body=event.body?JSON.parse(event.isBase64Encoded?Buffer.from(event.body,'base64').toString('utf8'):event.body):{}; }
  catch {return {statusCode:400,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({error:'Некорректные данные формы.'})};}
  const headers={};
  const req={method:event.httpMethod,headers:Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v])),body};
  let statusCode=200,responseBody='';
  const res={setHeader(k,v){headers[k]=v},status(code){statusCode=code;return this},json(value){headers['Content-Type']='application/json; charset=utf-8';responseBody=JSON.stringify(value)},end(){}};
  await rsvp(req,res);
  return {statusCode,headers,body:responseBody};
};
