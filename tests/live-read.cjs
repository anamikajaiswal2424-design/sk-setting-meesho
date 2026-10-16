const { MongoClient }=require('mongodb');
const fs=require('fs');
const storeConfig=require('../store-config');
(async()=>{let client;try{const uri=fs.readFileSync('.env.local','utf8').trim().split('MONGODB_URI=')[1];client=await new MongoClient(uri,{serverSelectionTimeoutMS:8000}).connect();console.log(JSON.stringify({connected:true,upiConfigured:!!String(storeConfig.upi?.id||'').trim(),pixelConfigured:!!String(storeConfig.facebookPixel?.id||'').trim(),collections:(await client.db('paytm_db').listCollections({},{nameOnly:true}).toArray()).map(x=>x.name)}));}catch(e){console.log(JSON.stringify({connected:false,error:e.name}));process.exitCode=1;}finally{await client?.close();}})();
