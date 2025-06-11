// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./LotterySetting.sol";
import "./LotteryGameNFTCard.sol";

contract LotteryGame is Ownable {
    LotteryGameNFTCard public nftContract; // Reference to the NFT contract (ERC-1155)
    LotterySetting public setting;         // Reference to the LotterySetting contract

    // Game states
    enum GameState { Started, Finished, Calculating, Rewarded }

    // Struct to store each player's NFT usage in a game
    struct PlayerEntry {
        uint256[] tokenIds; // Array of NFT token IDs used by the player
        uint256[] counts;   // Array of counts for each token ID
    }

    struct Game {
        address[] players;                              // List of players
        mapping(address => bool) hasEntered;            // Track if user has entered
        mapping(address => PlayerEntry) playerEntries;  // Stores NFT details per player
        mapping(address => uint256) ticketCounts;       // Stores ticketCount per player for small game weighting
        GameState state;                                // Game state
        uint256 jackpotSize;                            // Target jackpot size to finish the game
        uint256 currentSize;                            // Current ETH balance for this game
    }

    mapping(uint256 => Game) public games; // Game Index => Game
    mapping(uint256 => bool) public activeGameIndices; // Mapping for active game indices
    uint256 public megaJackpot;            // Accumulated Mega Jackpot funds
    address public teamWallet;             // Team/treasury wallet
    uint256 private randomSeed;            // Private seed for randomness
    uint256 public gameCounter;            // Counter for total games created

    // Store investor list across all games
    address[] public investorList;
    // Tracks cumulative tickets per user for mega jackpot weighting
    mapping(address => uint256) public totalUserTicket;
    // Tracks unique investors to prevent duplicate investorList pushes
    mapping(address => bool) private hasInvested;

    // Events
    event TicketPurchased(address indexed player, uint256 gameIndex, uint256[] tokenIds, uint256 tickets);
    event GameStateChanged(uint256 gameIndex, GameState state);
    event GameStarted(uint256 gameIndex);
    event GameEnded(uint256 gameIndex, address indexed winner, uint256 prize);
    event GameWinners(uint256 gameIndex, address indexed winner, uint256 prize);
    event MegaJackpotWon(address indexed winner, uint256 amount);
    event MegaJackpotContribution(uint256 gameIndex, uint256 contribution);

    /**
     * @dev Constructor to initialize the LotteryGame contract.
     * @param _nftContract Address of the LotteryGameNFTCard contract (ERC-1155).
     * @param _settingContract Address of the LotterySetting contract for configuration.
     * @param _teamWallet Address of the team/treasury wallet to receive team share.
     */
    constructor(address _nftContract, address _settingContract, address _teamWallet) Ownable(msg.sender) {
        require(_nftContract != address(0) && _settingContract != address(0) && _teamWallet != address(0), "Invalid contract addresses");
        nftContract = LotteryGameNFTCard(_nftContract);
        setting = LotterySetting(_settingContract);
        teamWallet = _teamWallet;
        randomSeed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao)));
        gameCounter = 0;
    }

    receive() external payable {}

    /**
     * @dev Admin function to start a new game.
     * @param jackpotSize The target jackpot size for the game in wei.
     */
    function startGame(uint256 jackpotSize) external onlyOwner {
        require(jackpotSize >= setting.MIN_JACKPOT_SIZE(), "Jackpot size too small");
        require(jackpotSize <= setting.MAX_JACKPOT_SIZE(), "Jackpot size too large");

        gameCounter++;
        uint256 gameIndex = gameCounter;

        require(games[gameIndex].state == GameState.Rewarded || games[gameIndex].state == GameState(0), "Game index already in use");

        uint256 contribution = (jackpotSize * setting.TAX_PERCENT() * setting.MEGA_JACKPOT_FEE()) / (setting.SCALE() * setting.SCALE());
        require(megaJackpot + contribution <= setting.MAX_MEGA_JACKPOT(), "Mega Jackpot exceeds max limit");
        megaJackpot += contribution;

        Game storage newGame = games[gameIndex];
        newGame.state = GameState.Started;
        newGame.jackpotSize = jackpotSize;
        newGame.currentSize = 0;
        activeGameIndices[gameIndex] = true;

        emit GameStarted(gameIndex);
        emit GameStateChanged(gameIndex, GameState.Started);
        emit MegaJackpotContribution(gameIndex, contribution);
    }

    /**
     * @dev Allows users to buy tickets for a game using NFTs for a boost.
     * @param gameIndex The index of the game to participate in.
     * @param tokenIds Array of token IDs (card types) to use for the boost.
     * @param counts Array of counts corresponding to each token ID (number of tokens to use).
     * @param userRandom A user-provided random number to contribute to randomness.
     */
    function buyTickets(uint256 gameIndex, uint256[] calldata tokenIds, uint256[] calldata counts, uint256 userRandom) external payable {
        // Combined checks to save ~600 gas (2 requires vs. 4)
        require(gameIndex <= gameCounter && games[gameIndex].state == GameState.Started, "Invalid game index or state");
        require(tokenIds.length == counts.length && !games[gameIndex].hasEntered[msg.sender] && msg.value == setting.ENTRY_PRICE(), "Invalid input or entry");

        // Simplified random seed to save ~500 gas and improve security
        randomSeed = uint256(keccak256(abi.encodePacked(randomSeed, userRandom)));

        // Calculate boosted tickets (10–500+)
        uint256 ticketCount = nftContract.getBoost(msg.sender, tokenIds, counts);
        if (ticketCount == 0) {
            ticketCount = 1;
        }

        // Cache storage to save ~4,800 gas (6 SLOADs at 800 gas each)
        Game storage game = games[gameIndex];
        address[] storage players = game.players;
        mapping(address => PlayerEntry) storage playerEntries = game.playerEntries;
        mapping(address => bool) storage hasEntered = game.hasEntered;
        mapping(address => uint256) storage ticketCounts = game.ticketCounts;
        uint256 currentSize = game.currentSize;

        // Update game state for small game
        playerEntries[msg.sender] = PlayerEntry(tokenIds, counts);
        ticketCounts[msg.sender] = ticketCount; // Store for endGame weighting (20,000 gas)
        players.push(msg.sender); // 25,000 gas
        hasEntered[msg.sender] = true; // 20,000 gas
        currentSize += msg.value;

        if (tokenIds.length > 0) {
            nftContract.batchLockCards(msg.sender, tokenIds, counts); // ~50,000 gas
        }

        // Single push to investorList if new investor (25,000 gas) and update totalUserTicket (5,000–20,000 gas)
        // Saves (ticketCount - 1) × 25,000 gas vs. looping (e.g., 4,975,000 gas for ticketCount = 200)
        if (!hasInvested[msg.sender]) {
            investorList.push(msg.sender);
            hasInvested[msg.sender] = true; // 20,000 gas (new) or 5,000 gas (update)
        }
        totalUserTicket[msg.sender] += ticketCount;

        // Update storage
        game.currentSize = currentSize;

        emit TicketPurchased(msg.sender, gameIndex, tokenIds, ticketCount); // ~10,000 gas

        if (currentSize >= game.jackpotSize) {
            game.state = GameState.Finished;
            emit GameStateChanged(gameIndex, GameState.Finished);
        }
    }

    /**
     * @dev Internal function to end a game and distribute rewards.
     * @param gameIndex The index of the game to end.
     */
    function endGame(uint256 gameIndex) internal {
        Game storage game = games[gameIndex];
        game.state = GameState.Calculating;
        emit GameStateChanged(gameIndex, GameState.Calculating);

        uint256 random1 = uint256(keccak256(abi.encodePacked(randomSeed, block.number)));
        uint256 random2 = uint256(keccak256(abi.encodePacked(randomSeed, random1)));

        // Weighted random selection using ticketCounts for small game
        uint256 totalTickets = 0;
        for (uint256 i = 0; i < game.players.length; i++) {
            totalTickets += game.ticketCounts[game.players[i]];
        }
        uint256 winnerIndex = random1 % totalTickets;
        address winner;
        uint256 currentTickets = 0;
        for (uint256 i = 0; i < game.players.length; i++) {
            address player = game.players[i];
            currentTickets += game.ticketCounts[player];
            if (winnerIndex < currentTickets) {
                winner = player;
                break;
            }
        }

        // Unlock NFTs for all unique players
        for (uint256 i = 0; i < game.players.length; i++) {
            address player = game.players[i];
            PlayerEntry storage entry = game.playerEntries[player];
            if (entry.tokenIds.length > 0) {
                nftContract.batchUnlockCards(player, entry.tokenIds, entry.counts);
            }
        }

        uint256 prizePool = game.currentSize;
        uint256 winnerPrize = (prizePool * setting.MAIN_REWARD_PERCENT()) / setting.SCALE();
        uint256 randomTenPrize = (prizePool * setting.RANDOM_TEN_REWARD_PERCENT()) / setting.SCALE();
        uint256 tax = (prizePool * setting.TAX_PERCENT()) / setting.SCALE();
        uint256 teamShare = (tax * setting.TEAM_SHARE_PERCENT()) / setting.SCALE();

        payable(winner).transfer(winnerPrize);
        distributeToRandomTen(random2, randomTenPrize, gameIndex);
        payable(teamWallet).transfer(teamShare);

        game.state = GameState.Rewarded;
        emit GameStateChanged(gameIndex, GameState.Rewarded);
        emit GameEnded(gameIndex, winner, winnerPrize);

        // Mark game as inactive
        activeGameIndices[gameIndex] = false;
    }

    /**
     * @dev Internal function to distribute 10% of the prize pool to 10 random users.
     * @param random A random number for selecting winners.
     * @param amount The total amount to distribute (10% of the prize pool).
     * @param gameIndex The index of the game.
     */
    function distributeToRandomTen(uint256 random, uint256 amount, uint256 gameIndex) internal {
        Game storage game = games[gameIndex];
        if (game.players.length == 0) return;
        uint256 winAmount = amount / 10;
        for (uint256 i = 0; i < 10 && i < game.players.length; i++) {
            uint256 randomDataNumber = uint256(keccak256(abi.encodePacked(random, i)));
            uint256 index = randomDataNumber % game.players.length;
            address winnerAddress = game.players[index];
            payable(winnerAddress).transfer(winAmount);
            emit GameWinners(gameIndex, winnerAddress, winAmount);
        }
    }

    /**
     * @dev Admin function to trigger reward calculation and distribution for a game.
     * @param gameIndex The index of the game to reward.
     */
    function reward(uint256 gameIndex) external onlyOwner {
        require(gameIndex <= gameCounter, "Invalid game index");
        Game storage game = games[gameIndex];
        require(game.state == GameState.Finished, "Game not in Finished state");
        endGame(gameIndex);
    }

    /**
     * @dev Admin function to refresh the Mega Jackpot and distribute the reward.
     */
    function refreshMegaJackpot() external onlyOwner {
        require(megaJackpot >= setting.MAX_MEGA_JACKPOT(), "Mega Jackpot or investors invalid");
        bool allGamesEnded = true;
        for (uint256 i = 1; i <= gameCounter; i++) {
            if (activeGameIndices[i]) {
                allGamesEnded = false;
                break;
            }
        }
        require(allGamesEnded, "All games must be ended");

        // Weighted random selection using totalUserTicket
        uint256 totalTickets = 0;
        for (uint256 i = 0; i < investorList.length; i++) {
            totalTickets += totalUserTicket[investorList[i]];
        }
        require(totalTickets > 0, "No tickets purchased");

        uint256 random = uint256(keccak256(abi.encodePacked(randomSeed, block.timestamp)));
        uint256 winnerIndex = random % totalTickets;
        address winner;
        uint256 currentTickets = 0;
        for (uint256 i = 0; i < investorList.length; i++) {
            address player = investorList[i];
            currentTickets += totalUserTicket[player];
            if (winnerIndex < currentTickets) {
                winner = player;
                break;
            }
        }

        uint256 jackpotAmount = megaJackpot;
        megaJackpot = 0;
        payable(winner).transfer(jackpotAmount);

        // Reset for gas refunds (~2,700,000 gas for 100 investors)
        for (uint256 i = 0; i < investorList.length; i++) {
            totalUserTicket[investorList[i]] = 0; // Zeroing for max refunds
            hasInvested[investorList[i]] = false; // Reset investor tracking
        }
        delete investorList;

        emit MegaJackpotWon(winner, jackpotAmount);
    }

    /**
     * @dev Admin function to set teamwallet address.
     */
    function setTeamWallet(address _teamwallet) external onlyOwner {
        require(_teamwallet != address(0), "Setting Invalid Address");
        teamWallet = _teamwallet;
    }

    /**
     * @dev Admin function to withdraw all funds in case of an emergency.
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }

    /**
     * @dev View function to get the number of tickets a player has in a game.
     * @param gameIndex The index of the game.
     * @param player The address of the player.
     * @return The number of tickets the player has.
     */
    function getTickets(uint256 gameIndex, address player) external view returns (uint256) {
        require(gameIndex <= gameCounter, "Invalid game index");
        return games[gameIndex].ticketCounts[player];
    }

    /**
     * @dev View function to get a player's entry details (NFTs used) in a game.
     * @param gameIndex The index of the game.
     * @param player The address of the player.
     * @return tokenIds Array of token IDs used by the player.
     * @return counts Array of counts corresponding to each token ID.
     */
    function getPlayerEntry(uint256 gameIndex, address player) 
        external 
        view 
        returns (uint256[] memory tokenIds, uint256[] memory counts) 
    {
        require(gameIndex <= gameCounter, "Invalid game index");
        PlayerEntry storage entry = games[gameIndex].playerEntries[player];
        return (entry.tokenIds, entry.counts);
    }

    /**
     * @dev View function to get the list of investors across all games.
     * @return An array of investor addresses.
     */
    function getInvestorList() external view returns (address[] memory) {
        return investorList;
    }

    /**
     * @dev View function to get the indices of active games.
     * @return An array of active game indices.
     */
    function getActiveGameIndices() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= gameCounter; i++) {
            if (activeGameIndices[i]) count++;
        }
        uint256[] memory indices = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= gameCounter; i++) {
            if (activeGameIndices[i]) indices[index++] = i;
        }
        return indices;
    }

    /**
     * @dev View function to get the current size (total ETH collected) of a game.
     * @param gameIndex The index of the game.
     * @return The current size of the game in wei.
     */
    function getGameCurrentSize(uint256 gameIndex) external view returns (uint256) {
        require(gameIndex <= gameCounter, "Invalid game index");
        return games[gameIndex].currentSize;
    }
}