import express from 'express';
import { globalErrorHandler } from './errors/AppError';

const app = express();

app.use(express.json({ limit: '10kb' }));

// routes go here

app.use(globalErrorHandler);

export default app;
