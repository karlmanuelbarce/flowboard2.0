import express, { NextFunction, Request, Response } from 'express';
import { globalErrorHandler } from './errors/AppError';
import boardsRouter from './routes/boards';
import tasksRouter from './routes/tasks';

const app = express();

app.use(express.json({ limit: '10kb' }));

// TODO: replace with authenticate middleware in Session 6
app.use((req: Request, _res: Response, next: NextFunction) => {
  req.user = { id: 'dcbbc40c-4e1d-4254-aed1-764cf287b5f7', email: 'dev@flowboard.test' };
  next();
});

app.use('/tasks', tasksRouter);
app.use('/boards', boardsRouter);

app.use(globalErrorHandler);

export default app;
