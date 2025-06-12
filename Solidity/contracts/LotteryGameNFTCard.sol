// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract LotteryGameNFTCard is ERC1155, Ownable {
    uint256 public constant NUM_CARD_TYPES = 6; // Total number of card types
    uint256 public constant MAX_MINT_COUNT = 3; // Max count per card
    uint256[] public cardPrices; // Prices for each card type in wei
    uint256[] public boostValues; // Boost values for each card type
    address public lotteryGame; // Address of the LotteryGame contract
    string private _name; // Token name
    string private _symbol; // Token symbol
    string private _baseURI; // Base URI for token metadata

    // Total supply limits for each card type
    uint256[] public totalSupplyLimits = [
        5,    // Diamond
        50,   // Platinum
        100,  // Gold
        200,  // Silver
        400,  // Bronze
        800   // Iron
    ];

    // Mapping to track the total minted count for each card type
    mapping(uint256 => uint256) public mintedCounts;

    // Mapping to track locked cards for each user and card type
    mapping(address => mapping(uint256 => uint256)) public lockedCards;

    /**
     * @dev Constructor to initialize the LotteryGameNFTCard contract.
     * @param baseURI_ The base URI for token metadata.
     */
    constructor(string memory baseURI_) ERC1155(baseURI_) Ownable(msg.sender) {
        _name = "LotteryGameCard";
        _symbol = "LGCard";
        _baseURI = baseURI_;

        // Initialize card prices (in wei)
        cardPrices = [
            200 ether,  // Diamond
            160 ether,  // Platinum
            120 ether,  // Gold
            80 ether,  // Silver
            40 ether,  // Bronze
            20 ether  // Iron
        ];

        // Initialize boost values for each card type
        boostValues = [
            60,  // Diamond
            40,  // Platinum
            30,  // Gold
            20,  // Silver
            10,  // Bronze
            5    // Iron
        ];
    }

    /**
     * @dev Returns the name of the token.
     * @return The name of the token.
     */
    function name() external view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token.
     * @return The symbol of the token.
     */
    function symbol() external view returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the base URI for token metadata.
     * @return The base URI.
     */
    function baseURI() external view returns (string memory) {
        return _baseURI;
    }

    /**
     * @dev Sets the base URI for token metadata (only callable by the owner).
     * @param newBaseURI The new base URI to set.
     */
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseURI = newBaseURI;
    }

    /**
     * @dev Returns the URI for a specific token ID.
     * @param tokenId The ID of the token.
     * @return The full URI for the token, with .json extension.
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < NUM_CARD_TYPES, "Invalid token ID");
        return string(abi.encodePacked(_baseURI, Strings.toString(tokenId), ".json"));
    }

    /**
     * @dev Admin function to set the tokenPrice.
     * @param _tokenType The type of the token.
     * @param _price The price of the token.
     */
    function setTokenPrice(uint256 _price, uint256 _tokenType) external onlyOwner {
        require(_tokenType < NUM_CARD_TYPES, "Invalid address");
        cardPrices[_tokenType] = _price;
    }
    
    /**
     * @dev Admin function to set the LotteryGame contract address.
     * @param _lotteryGame The address of the LotteryGame contract.
     */
    function setLotteryGame(address _lotteryGame) external onlyOwner {
        require(_lotteryGame != address(0), "Invalid address");
        lotteryGame = _lotteryGame;
    }

    /**
     * @dev Allows users to mint new NFT cards by paying the required price.
     * @param to The address to mint the cards to.
     * @param cardType The type of card to mint (0 to NUM_CARD_TYPES-1).
     * @param amount The number of cards to mint.
     */
    function mint(address to, uint256 cardType, uint256 amount) external payable {
        require(cardType < NUM_CARD_TYPES, "Invalid card type");
        require(amount > 0 && MAX_MINT_COUNT >= amount, "Amount must be greater than 0 and smaller than 3");
        require(msg.value >= cardPrices[cardType] * amount, "Insufficient payment");

        // Check total supply limit
        uint256 newMintedCount = mintedCounts[cardType] + amount;
        require(newMintedCount <= totalSupplyLimits[cardType], "Exceeds total supply for this card type");

        // Update minted count
        mintedCounts[cardType] = newMintedCount;

        _mint(to, cardType, amount, "");
    }

    /**
     * @dev Allows the owner to airdrop NFT cards to multiple users.
     * @param recipients Array of addresses to receive the cards.
     * @param cardType The type of card to airdrop (0 to NUM_CARD_TYPES-1).
     * @param amounts Array of amounts to airdrop to each recipient.
     */
    function airdrop(address[] calldata recipients, uint256 cardType, uint256[] calldata amounts) external onlyOwner {
        require(cardType < NUM_CARD_TYPES, "Invalid card type");
        require(recipients.length == amounts.length, "Recipients and amounts length mismatch");
        require(recipients.length > 0, "Must provide at least one recipient");

        // Calculate total amount to airdrop
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "Amount must be greater than 0");
            totalAmount += amounts[i];
        }

        // Check total supply limit
        uint256 newMintedCount = mintedCounts[cardType] + totalAmount;
        require(newMintedCount <= totalSupplyLimits[cardType], "Exceeds total supply for this card type");

        // Update minted count
        mintedCounts[cardType] = newMintedCount;

        // Airdrop to each recipient
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], cardType, amounts[i], "");
        }
    }

    // Modifier to restrict function calls to only the lotteryGame address
    modifier onlyLotteryGame() {
        require(msg.sender == lotteryGame, "Only LotteryGame can call this function");
        _;
    }

    // Batch lock multiple card types for a user
    function batchLockCards(address user, uint256[] calldata tokenIds, uint256[] calldata amounts) external onlyLotteryGame {
        require(tokenIds.length == amounts.length, "Token IDs and amounts length mismatch");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 cardType = tokenIds[i];
            uint256 amount = amounts[i];
            require(cardType < NUM_CARD_TYPES, "Invalid card type");
            require(amount > 0, "Amount must be greater than 0");

            uint256 availableCards = balanceOf(user, cardType) - lockedCards[user][cardType];
            require(availableCards >= amount, "Not enough unlocked cards");

            lockedCards[user][cardType] += amount;
        }
    }

    // Batch unlock multiple card types for a user
    function batchUnlockCards(address user, uint256[] calldata tokenIds, uint256[] calldata amounts) external onlyLotteryGame {
        require(tokenIds.length == amounts.length, "Token IDs and amounts length mismatch");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 cardType = tokenIds[i];
            uint256 amount = amounts[i];
            require(cardType < NUM_CARD_TYPES, "Invalid card type");
            require(amount > 0, "Amount must be greater than 0");
            require(lockedCards[user][cardType] >= amount, "Not enough locked cards");

            lockedCards[user][cardType] -= amount;
        }
    }

    /**
     * @dev Calculates the total boost for a user based on the number of cards used.
     * @param user The address of the user.
     * @param tokenIds Array of token IDs (card types) to use for the boost.
     * @param counts Array of counts corresponding to each token ID (number of tokens to use).
     * @return The total boost value.
     */
    function getBoost(address user, uint256[] calldata tokenIds, uint256[] calldata counts) external view returns (uint256) {
        require(tokenIds.length == counts.length, "Token IDs and counts length mismatch");
        uint256 totalBoost = 0;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 cardType = tokenIds[i];
            uint256 count = counts[i];
            if (count == 0) continue; // Skip if count is 0
            require(cardType < NUM_CARD_TYPES, "Invalid card type");

            uint256 availableCards = balanceOf(user, cardType) - lockedCards[user][cardType];
            require(availableCards >= count, "Not enough unlocked cards");

            // Boost is calculated as boost value per card type multiplied by the number of cards used
            totalBoost += boostValues[cardType] * count;
        }

        return totalBoost;
    }

    /**
     * @dev View function to get a user's total, locked, and unlocked balances for all card types.
     * @param user The address of the user.
     * @return totalBalances Array of total balances for each card type.
     * @return lockedBalances Array of locked balances for each card type.
     * @return unlockedBalances Array of unlocked balances for each card type.
     */
    function getUserBalances(address user) 
        external 
        view 
        returns (
            uint256[] memory totalBalances, 
            uint256[] memory lockedBalances, 
            uint256[] memory unlockedBalances
        )
    {
        totalBalances = new uint256[](NUM_CARD_TYPES);
        lockedBalances = new uint256[](NUM_CARD_TYPES);
        unlockedBalances = new uint256[](NUM_CARD_TYPES);

        for (uint256 i = 0; i < NUM_CARD_TYPES; i++) {
            totalBalances[i] = balanceOf(user, i);
            lockedBalances[i] = lockedCards[user][i];
            unlockedBalances[i] = totalBalances[i] - lockedBalances[i];
        }
    }

    /**
     * @dev Overrides ERC-1155's safeTransferFrom to prevent transferring locked cards.
     * @param from The address transferring the tokens.
     * @param to The address receiving the tokens.
     * @param id The token ID (card type) to transfer.
     * @param amount The number of tokens to transfer.
     * @param data Additional data to pass to the receiver.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public override {
        require(id < NUM_CARD_TYPES, "Invalid card type");
        uint256 availableCards = balanceOf(from, id) - lockedCards[from][id];
        require(availableCards >= amount, "Cannot transfer locked cards");

        super.safeTransferFrom(from, to, id, amount, data);
    }

    /**
     * @dev Overrides ERC-1155's safeBatchTransferFrom to prevent transferring locked cards.
     * @param from The address transferring the tokens.
     * @param to The address receiving the tokens.
     * @param ids Array of token IDs (card types) to transfer.
     * @param amounts Array of amounts corresponding to each token ID.
     * @param data Additional data to pass to the receiver.
     */
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public override {
        require(ids.length == amounts.length, "IDs and amounts length mismatch");

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 id = ids[i];
            uint256 amount = amounts[i];
            require(id < NUM_CARD_TYPES, "Invalid card type");
            uint256 availableCards = balanceOf(from, id) - lockedCards[from][id];
            require(availableCards >= amount, "Cannot transfer locked cards");
        }

        super.safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    /**
     * @dev Admin function to withdraw all funds in the contract.
     */
    function withDraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }
}