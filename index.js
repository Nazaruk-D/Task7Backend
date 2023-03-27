const express = require('express');
const app = express();
const cors = require('cors');
const http = require('http');
const server = http.createServer(app);

const corsOptions = {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

const io = require('socket.io')(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

let currentGames = [];


io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('message', (data) => {
        console.log('Message received:', data);
        socket.emit('message', 'Server received message');

    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });

    socket.on('set-name', (name) => {
        socket.userName = name;
        console.log(`User ${name} connected`);
    });


    socket.on('join-game', (data) => {
        const gameId = data.gameId;
        const playerName = data.playerName;
        let game = currentGames.find((g) => g.id === gameId);
        if (!game) {
            game = {id: gameId, players: []};
            currentGames.push(game);
        }
        if (game.players.length === 2) {
            socket.emit('join-game-failed', 'too many players');
            return
        }

        game.players.push({name: playerName, id: socket.id});


        const [player1, player2] = game.players.map((p) => p.name);
        const [id1, id2] = game.players.map((p) => p.id);

        socket.to(id1).to(id2).emit('join-game-success', {gameId: game.id, players: game.players});

        if (game.players.length === 2) {
            const firstPlayer = flipCoin() ? player1 : player2;
            io.to(id1).to(id2).emit('start-game', {gameId: game.id, players: game.players, userMove: firstPlayer});
        }

    });

    socket.on('make-move', (data) => {
        const gameId = data.gameId;
        const playerId = socket.id;
        const board = data.board
        console.log(gameId, playerId, board)


        const game = currentGames.find((g) => g.id === gameId);

        const playerIds = game.players.map((p) => p.id);

        playerIds.forEach((id) => {
            io.to(id).emit('update-game-state', {gameState: game.state});
        })
    })
});


function flipCoin() {
    return Math.random() > 0.5;
}

server.listen(8080, () => {
    console.log('Server started on port 8080');
});