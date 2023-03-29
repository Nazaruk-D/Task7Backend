const findOrCreateGame = (gamesList, gameName, gameId) => {
    let game = gamesList.find((g) => g.id === gameId);
    if (gameId === "new room") {
        game = gamesList.find(g => g.players.length < 2);
        if (!game) {
            const newGameId = gamesList.reduce((maxId, game) => Math.max(maxId, game.id), 0) + 1;
            game = {id: newGameId, gameName, players: []};
            gamesList.push(game);
        }
    }
    if (!game) {
        game = {id: gameId, gameName, players: []};
        gamesList.push(game);
    }
    return game
}

module.exports = { findOrCreateGame };