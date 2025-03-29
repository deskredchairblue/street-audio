import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import audioRoutes from './routes/audioRoutes';
import { securityMiddleware } from './middlewares/security';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(securityMiddleware);

app.use('/api/audio', audioRoutes);

export default app;
