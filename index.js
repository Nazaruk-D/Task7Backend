const express = require('express');
const app = express();
const cors = require('cors');
const http = require('http');
const {findOrCreateGame} = require("./findOrCreateGame");
const {checkNumberBullsAndCows} = require("./checkNumberBullsAndCows");
const {calculateWinner} = require("./calculateWinnerTikTakToe");
const {flipCoin} = require("./flipCoin");
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


let tikTakToe = [];
let bullsAndCowsGames = [];

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.emit('user-id', socket.id);

    socket.on('message', (data) => {
        console.log('Message received:', data);
        socket.emit('message', 'Server received message');
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        let game;
        let player;
        for (const g of tikTakToe.concat(bullsAndCowsGames)) {
            player = g.players.find((p) => p.id === socket.id);
            if (player) {
                game = g;
                break;
            }
        }
        if (game) {
            const otherPlayer = game.players.find((p) => p.id !== socket.id);
            if (otherPlayer) {
                const message = "opponent disconnected"
                io.to(otherPlayer.id).emit('game-over', {gameId: game.id, gameName: game.gameName, winner: otherPlayer.id, message});
            }
            if (game.gameName === 'tikTakToe') {
                tikTakToe = tikTakToe.filter((g) => g.id !== game.id);
            } else {
                bullsAndCowsGames = bullsAndCowsGames.filter((g) => g.id !== game.id);
            }
        }
    });

    socket.on('set-name', (name) => {
        socket.userName = name;
        console.log(`User ${name} connected`);
    });

    socket.on('join-game', (data) => {
        const gameId = data.gameId;
        const gameName = data.gameName;
        const playerName = data.playerName;

        let game;
        if (gameName === "bullsAndCows") {
            game = findOrCreateGame(bullsAndCowsGames, gameName, gameId);
        } else if (gameName === "tikTakToe") {
            game = findOrCreateGame(tikTakToe, gameName, gameId);
            if (gameName !== game.gameName) {
                socket.emit('join-game-failed', 'You are trying to connect to another game');
                return;
            }
        }

        if (game.players.length === 2) {
            socket.emit('join-game-failed', 'too many players in this room');
            return;
        }

        game.players.push({name: playerName, id: socket.id});
        const [player1, player2] = game.players.map((p) => p.id);
        const [id1, id2] = game.players.map((p) => p.id);
        io.to(id1).to(id2).emit('join-game-success', {gameId: game.id, gameName: game.gameName, players: game.players});
        if (game.players.length === 2) {
            const firstPlayer = flipCoin() ? player1 : player2;
            io.to(id1).to(id2).emit('start-game', {
                gameId: game.id,
                gameName: game.gameName,
                players: game.players,
                userMoveId: firstPlayer,
            });
        }
    });

    socket.on('game-preparation', (data) => {
        const gameId = data.gameId;
        const playerId = socket.id;
        const number = data.number

        let game = bullsAndCowsGames.find((g) => g.id === gameId);
        const [id1, id2] = game.players.map((p) => p.id);
        const firstPlayer = flipCoin() ? id1 : id2;
        const playerIndex = game.players.findIndex((p) => p.id === playerId);
        game.players[playerIndex].number = number;
        if (game.players.every((p) => p.number !== undefined)) {
            io.to(id1).to(id2).emit('start-game-move', {
                gameId: game.id,
                gameName: game.gameName,
                players: game.players,
                userMoveId: firstPlayer,
            });
        }
    })

    socket.on('make-move', (data) => {
        const gameId = data.gameId;
        const playerId = socket.id;
        const gameName = data.gameName;
        const board = data.board
        const stepNumber = data.stepNumber + 1

        let game;
        if (gameName === "bullsAndCows") {
            game = bullsAndCowsGames.find((g) => g.id === gameId);
            const {bulls, cows} = checkNumberBullsAndCows(game, playerId, board);
            const currentPlayerIndex = game.players.findIndex((player) => player.id === playerId);
            const nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length;
            game.userMoveId = game.players[nextPlayerIndex].id;
            const playerIds = game.players.map((p) => p.id);
            if(bulls === 4) {
                playerIds.forEach((id) => {
                    io.to(id).emit('game-over', {gameId, board, gameName: game.gameName, userMoveId: game.userMoveId, bulls, cows, winner: game.userMoveId});
                    bullsAndCowsGames = bullsAndCowsGames.filter((g) => g.id !== gameId);
                })
            } else {
                playerIds.forEach((id) => {
                    io.to(id).emit('check-number-result', {gameId, board, gameName: game.gameName, userMoveId: game.userMoveId, bulls, cows});
                })
            }
        } else if (gameName === "tikTakToe") {
            game = tikTakToe.find((g) => g.id === gameId);
            game.board = board;
            const winner = calculateWinner(board, game.userMoveId, stepNumber);
            const currentPlayerIndex = game.players.findIndex((player) => player.id === playerId);
            const nextPlayerIndex = (currentPlayerIndex + 1) % game.players.length;
            game.userMoveId = game.players[nextPlayerIndex].id;
            const playerIds = game.players.map((p) => p.id);
            if(winner){
                playerIds.forEach((id) => {
                    io.to(id).emit('game-over', {gameId, board, gameName: game.gameName, userMoveId: game.userMoveId, winner});
                    tikTakToe = tikTakToe.filter((g) => g.id !== gameId);
                })
            } else {
                playerIds.forEach((id) => {
                    io.to(id).emit('update-game-state', {gameId, board, gameName: game.gameName, userMoveId: game.userMoveId});
                })
            }
        }
    })

    socket.on('game-over', (data) => {
        const gameId = data.gameId;
        const info = data.info
        const gameName = data.gameName;

        let game;
        if (gameName === "bullsAndCows") {
            game = bullsAndCowsGames.find((g) => g.id === gameId);
        } else if (gameName === "tikTakToe") {
            game = tikTakToe.find((g) => g.id === gameId);
        }

        const playerIds = game.players.map((p) => p.id);
        playerIds.forEach((id) => {
            io.to(id).emit('game-over', {gameId, info});
        })
    })

    socket.on('game-over-timer', (data) => {
        const gameId = data.gameId;
        const gameName = data.gameName;
        const userId = data.userId


        let game;
        if (gameName === "bullsAndCows") {
            game = bullsAndCowsGames.find((g) => g.id === gameId);
        } else if (gameName === "tikTakToe") {
            game = tikTakToe.find((g) => g.id === gameId);
        }

        if (game) {
            const playerIds = game.players.map((p) => p.id);
            const winner = game.players.find( p => p.id !== userId)
            playerIds.forEach((id) => {
                io.to(id).emit('game-over-timer', {winner});
            })

            if (gameName === "bullsAndCows") {
                bullsAndCowsGames = bullsAndCowsGames.filter((g) => g.id !== gameId);
            } else if (gameName === "tikTakToe") {
                tikTakToe = tikTakToe.filter((g) => g.id !== gameId);
            }
        }
    })
});


server.listen(8080, () => {
    console.log('Server started on port 8080');
});