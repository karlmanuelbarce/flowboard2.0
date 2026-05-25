import prisma from '../lib/prisma';

export async function handleTaskUpdated(taskId: string, userId: string): Promise<void> {
  await prisma.auditLog.create({
    data: { userId, action: 'UPDATED', entity: 'Task', entityId: taskId },
  });
}
