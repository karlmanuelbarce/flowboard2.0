import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const hashedPassword = await bcrypt.hash('DevPassword123!', 12);

  const user = await prisma.user.upsert({
    where: { email: 'dev@flowboard.test' },
    update: {},
    create: {
      email: 'dev@flowboard.test',
      password: hashedPassword,
    },
  });

  console.log(`Upserted user: ${user.email} (${user.id})`);

  const existingBoards = await prisma.board.findMany({
    where: { ownerId: user.id },
  });

  if (existingBoards.length >= 2) {
    console.log('Boards already seeded — skipping.');
    return;
  }

  const boardA = await prisma.board.create({
    data: { name: 'Project Alpha', ownerId: user.id },
  });

  const boardB = await prisma.board.create({
    data: { name: 'Project Beta', ownerId: user.id },
  });

  console.log(`Created boards: ${boardA.name}, ${boardB.name}`);

  await prisma.task.createMany({
    data: [
      {
        title: 'Set up repository',
        description: 'Init git, add .gitignore, create base structure',
        priority: 'HIGH',
        status: 'DONE',
        boardId: boardA.id,
        ownerId: user.id,
      },
      {
        title: 'Define data model',
        description: 'Write Prisma schema for all entities',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        boardId: boardA.id,
        ownerId: user.id,
      },
      {
        title: 'Write integration tests',
        description: 'Cover all endpoints with happy and error paths',
        priority: 'MEDIUM',
        status: 'TODO',
        boardId: boardA.id,
        ownerId: user.id,
      },
    ],
  });

  console.log('Created 3 tasks on Project Alpha');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
