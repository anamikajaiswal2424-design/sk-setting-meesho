const { MongoClient } = require('mongodb');
let connection;
module.exports = async function databases() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
  if (!connection) connection = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 }).connect().catch(e => { connection = null; throw e; });
  const client = await connection;
  return { main: client.db('test'), ledger: client.db('paytm_db') };
};
