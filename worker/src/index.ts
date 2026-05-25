import redis from './lib/redis';
import { handleTaskCreated } from './handlers/taskCreated';
import { handleTaskUpdated } from './handlers/taskUpdated';
import { handleTaskDeleted } from './handlers/taskDeleted';

const STREAM = 'tasks:events';
const GROUP = 'audit-group';
const CONSUMER = 'worker-1';
const DLQ = 'tasks:events:dlq';
const MAX_RETRIES = 3;

function parseFields(fields: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    result[fields[i]] = fields[i + 1];
  }
  return result;
}

async function dispatch(action: string, taskId: string, userId: string): Promise<void> {
  if (action === 'CREATED') return handleTaskCreated(taskId, userId);
  if (action === 'UPDATED') return handleTaskUpdated(taskId, userId);
  if (action === 'DELETED') return handleTaskDeleted(taskId, userId);
  throw new Error(`Unknown action: ${action}`);
}

async function processMessage(messageId: string, fields: string[]): Promise<void> {
  const { action, taskId, userId } = parseFields(fields);
  try {
    await dispatch(action, taskId, userId);
    await redis.xack(STREAM, GROUP, messageId);
    console.log(`[worker] ACK ${messageId} action=${action} taskId=${taskId}`);
  } catch (err) {
    const retryKey = `retry:${messageId}`;
    const count = await redis.hincrby(retryKey, 'count', 1);
    if (count < MAX_RETRIES) {
      console.warn(`[worker] handler error (attempt ${count}/${MAX_RETRIES}) msgId=${messageId}:`, err);
    } else {
      console.error(`[worker] DLQ after ${count} attempts msgId=${messageId}:`, err);
      await redis.xadd(
        DLQ, '*',
        'originalId', messageId,
        'action', action ?? '',
        'taskId', taskId ?? '',
        'error', err instanceof Error ? err.message : String(err),
        'failedAt', Date.now().toString(),
      );
      await redis.xack(STREAM, GROUP, messageId);
      await redis.del(retryKey);
    }
  }
}

async function run(): Promise<void> {
  try {
    await redis.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM');
    console.log(`[worker] consumer group "${GROUP}" created`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('BUSYGROUP')) {
      console.log(`[worker] consumer group "${GROUP}" already exists`);
    } else {
      throw err;
    }
  }

  console.log(`[worker] listening on stream "${STREAM}"`);

  while (true) {
    const results = await redis.xreadgroup(
      'GROUP', GROUP, CONSUMER,
      'COUNT', '10',
      'BLOCK', '5000',
      'STREAMS', STREAM, '>',
    ) as Array<[string, Array<[string, string[]]>]> | null;

    if (!results) continue;

    for (const [, messages] of results) {
      for (const [messageId, fields] of messages) {
        await processMessage(messageId, fields);
      }
    }
  }
}

run().catch((err) => {
  console.error('[worker] fatal error:', err);
  process.exit(1);
});
