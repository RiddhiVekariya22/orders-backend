require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

const schema = fs.readFileSync('./schema.sql', 'utf8');
const jobsSchema = fs.readFileSync('./jobs-schema.sql', 'utf8');

const shardUrls = [
  process.env.SHARD_0_URL,
  process.env.SHARD_1_URL,
  process.env.SHARD_2_URL,
  process.env.SHARD_3_URL,
];

async function migrateAll() {
  for (let i = 0; i < shardUrls.length; i++) {
    const client = new Client({ connectionString: shardUrls[i] });
    await client.connect();
    console.log(`Applying schema to shard_${i}...`);
    await client.query(schema);
    await client.end();
    console.log(`shard_${i} done`);
  }

  const client = new Client({ connectionString: process.env.CONTROL_DB_URL });
  await client.connect();
  console.log('Applying jobs schema to control_db...');
  await client.query(jobsSchema);
  await client.end();
  console.log('control_db done');
}

migrateAll().catch(console.error);