import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import prisma from '../lib/prisma';

const router = Router();

const TaskIdParam = z.object({
  id: z.string().uuid(),
});

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  boardId: z.string().uuid(),
});

const UpdateTaskSchema = CreateTaskSchema.partial();

type TaskIdParamType = z.infer<typeof TaskIdParam>;
type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

router.get(
  '/:id',
  async (req: Request<TaskIdParamType>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = TaskIdParam.parse(req.params);
      const task = await prisma.task.findUnique({ where: { id } });
      if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
      res.json({ success: true, data: task });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body: CreateTaskInput = CreateTaskSchema.parse(req.body);
      const task = await prisma.task.create({
        data: { ...body, ownerId: req.user!.id },
      });
      res.status(201).json({ success: true, data: task });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  async (
    req: Request<TaskIdParamType>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = TaskIdParam.parse(req.params);
      const body: UpdateTaskInput = UpdateTaskSchema.parse(req.body);
      const task = await prisma.task.update({ where: { id }, data: body });
      res.json({ success: true, data: task });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  async (req: Request<TaskIdParamType>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = TaskIdParam.parse(req.params);
      await prisma.task.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
