import prisma from '../lib/prisma';

export async function handleTaskCreated(taskId: string, userId: string): Promise<void> {
  await prisma.auditLog.create({
    data: { userId, action: 'CREATED', entity: 'Task', entityId: taskId },
  });
}
