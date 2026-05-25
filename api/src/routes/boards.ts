import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import prisma from '../lib/prisma';

const router = Router();

const BoardIdParam = z.object({
  id: z.string().uuid(),
});

const CreateBoardSchema = z.object({
  name: z.string().min(1).max(100),
});

type BoardIdParamType = z.infer<typeof BoardIdParam>;
type CreateBoardInput = z.infer<typeof CreateBoardSchema>;

router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const boards = await prisma.board.findMany({
        where: { ownerId: req.user!.id },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: boards });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body: CreateBoardInput = CreateBoardSchema.parse(req.body);
      const board = await prisma.board.create({
        data: { ...body, ownerId: req.user!.id },
      });
      res.status(201).json({ success: true, data: board });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id',
  async (req: Request<BoardIdParamType>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = BoardIdParam.parse(req.params);
      const board = await prisma.board.findUnique({ where: { id } });
      if (!board) throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
      res.json({ success: true, data: board });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  async (req: Request<BoardIdParamType>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = BoardIdParam.parse(req.params);
      const board = await prisma.board.findUnique({ where: { id } });
      if (!board) throw new AppError('Board not found', 404, 'BOARD_NOT_FOUND');
      if (board.ownerId !== req.user!.id) throw new AppError('Forbidden', 403, 'FORBIDDEN');
      await prisma.board.delete({ where: { id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
