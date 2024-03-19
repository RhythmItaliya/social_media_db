// config.js

const config = {
    // CORS configuration
    corsOptions: {
        origin: 'http://localhost:3000',
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        allowedHeaders: 'Content-Type, Authorization',
        optionsSuccessStatus: 204,
    },
    // Server configuration
    server: {
        port: 8080,
    },
    // Socket.IO configuration
    socketIO: {
        cors: {
            origin: 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization'],
        },
    },
    // Cookie parser secret key
    cookieSecret: 'QWERTYUIOPLKJHGFDSAZXCVBNM',
};

module.exports = config;