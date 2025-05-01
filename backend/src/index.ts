import {config as loadEnv} from 'dotenv';
import { httpServer, ioServer, socketManager } from './singletons';
loadEnv();
httpServer.listen(process.env.HTTP_PORT, () => {
    console.log(`Server is running on port ${process.env.HTTP_PORT} at http://localhost:${process.env.HTTP_PORT}`);
});

ioServer.use(socketManager.middleware);