function checkNumberBullsAndCows(game, playerId, number) {
    const playerIndex = game.players.findIndex((p) => p.id === playerId);
    let bulls = 0;
    let cows = 0;
    for (let i = 0; i < number.length; i++) {
        if (number[i] === game.players[1 - playerIndex].number[i]) {
            bulls++;
        } else if (game.players[1 - playerIndex].number.includes(number[i])) {
            cows++;
        }
    }
    return {bulls, cows};
}

module.exports = { checkNumberBullsAndCows };