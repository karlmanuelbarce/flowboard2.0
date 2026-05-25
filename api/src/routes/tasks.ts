import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';

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
      // TODO: replace with prisma.task.findUnique on Day 2
      throw new AppError(`Task ${id} not found`, 404, 'TASK_NOT_FOUND');
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
      // TODO: replace with prisma.task.create on Day 2
      res.status(201).json({ success: true, data: { ...body, id: 'stub-id' } });
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
      // TODO: replace with prisma.task.update on Day 2
      res.status(200).json({ success: true, data: { id, ...body } });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  async (req: Request<TaskIdParamType>, res: Response, next: NextFunction): Promise<void> => {
    try {
      TaskIdParam.parse(req.params);
      // TODO: replace with prisma.task.delete on Day 2
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
