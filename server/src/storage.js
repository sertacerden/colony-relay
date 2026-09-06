import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { LEVEL_VERSION } from '../../shared/config.js';
import { SECTORS } from '../../shared/levels.js';

export class FileStore {
  constructor(dir = process.env.SAVE_DIR || './server/data') { this.dir = resolve(dir); }
  path(id) {
    if (!/^[A-Z0-9]{6}$/.test(id)) throw new Error('Invalid save id');
    return join(this.dir, `${id}.json`);
  }
  async load(id) {
    try { return JSON.parse(await readFile(this.path(id), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async save(item, expectedVersion) {
    // Single-process development adapter. Room serializes all writes.
    await mkdir(this.dir, { recursive: true });
    const old = await this.load(item.room);
    if ((old?.version || 0) !== expectedVersion) throw new Error('Save version conflict');
    const record = { ...item, version: expectedVersion + 1 };
    const path = this.path(item.room);
    await writeFile(`${path}.tmp`, JSON.stringify(record, null, 2));
    await rename(`${path}.tmp`, path);
    return record.version;
  }
}
export class DynamoStore {
  static async create() {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient, GetCommand, PutCommand } = await import('@aws-sdk/lib-dynamodb');
    if (!process.env.DYNAMO_TABLE) throw new Error('DYNAMO_TABLE is required');
    return new DynamoStore(DynamoDBDocumentClient.from(new DynamoDBClient({})), GetCommand, PutCommand);
  }
  constructor(client, GetCommand, PutCommand) { Object.assign(this, { client, GetCommand, PutCommand }); }
  async load(id) {
    const result = await this.client.send(new this.GetCommand({ TableName: process.env.DYNAMO_TABLE,
      Key: { PK: `SESSION#${id}`, SK: 'STATE' }, ConsistentRead: true }));
    return result.Item || null;
  }
  async save(item, expectedVersion) {
    const version = expectedVersion + 1;
    await this.client.send(new this.PutCommand({ TableName: process.env.DYNAMO_TABLE,
      Item: { ...item, version },
      ConditionExpression: expectedVersion === 0 ? 'attribute_not_exists(PK)' : '#v = :expected',
      ...(expectedVersion ? { ExpressionAttributeNames: { '#v': 'version' },
        ExpressionAttributeValues: { ':expected': expectedVersion } } : {}) }));
    return version;
  }
}
export function validateSave(record) {
  if (!record) return null;
  if (record.schemaVersion === 1 && record.levelVersion === 1 && Number.isInteger(record.sector) && record.sector >= 0 && record.sector < 3 && record.roster) {
    record = {...record, levelVersion: LEVEL_VERSION, completed:false, puzzle:{latched:false,participants:[]},
      roster:Object.fromEntries(Object.entries(record.roster).map(([id,p])=>[id,{...p,checkpoint:0}]))};
  }
  if (record.schemaVersion !== 1 || record.levelVersion !== LEVEL_VERSION
    || !Number.isInteger(record.sector) || record.sector < 0 || record.sector >= SECTORS.length
    || !record.roster || typeof record.roster !== 'object') throw new Error('Incompatible save');
  return record;
}
