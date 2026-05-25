import prisma from '../lib/prisma';

export async function handleTaskDeleted(taskId: string, userId: string): Promise<void> {
  await prisma.auditLog.create({
    data: { userId, action: 'DELETED', entity: 'Task', entityId: taskId },
  });
}
