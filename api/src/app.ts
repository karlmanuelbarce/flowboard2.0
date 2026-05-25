import express from 'express';
import { globalErrorHandler } from './errors/AppError';
import { authenticate } from './middleware/authenticate';
import authRouter from './routes/auth';
import boardsRouter from './routes/boards';
import tasksRouter from './routes/tasks';

const app = express();

app.use(express.json({ limit: '10kb' }));

app.use('/auth', authRouter);

app.use('/boards', authenticate, boardsRouter);
app.use('/tasks', authenticate, tasksRouter);

app.use(globalErrorHandler);

export default app;
