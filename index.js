const express = require('express');
const app = express();
const cors = require('cors');
const http = require('http');
const {handleSocket} = require("./socketHandlers");
const server = http.createServer(app);

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST'],
    optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

const io = require('socket.io')(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

io.on('connection', handleSocket(io));

server.listen(8080, () => {
    console.log('Server started on port 8080');
});