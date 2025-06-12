// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";

contract LotterySetting is Ownable {
    uint256 public constant SCALE = 10000;

    // Fee-related settings
    uint256 public TAX_PERCENT = 1000; // 10% of prize pool
    uint256 public MEGA_JACKPOT_FEE = 5000; // 50% of tax
    uint256 public MAIN_REWARD_PERCENT = 8000; // 80% of prize pool
    uint256 public RANDOM_TEN_REWARD_PERCENT = 1000; // 10% of prize pool
    uint256 public TEAM_SHARE_PERCENT = 5000; // 50% of tax

    // Game settings
    uint256 public ENTRY_PRICE = 20 ether;
    uint256 public MIN_JACKPOT_SIZE = 200 ether;
    uint256 public MAX_JACKPOT_SIZE = 2000 ether;
    uint256 public MAX_MEGA_JACKPOT = 1000000 ether;

    constructor() Ownable(msg.sender) {}

    // Combined setter for tax, main reward, and random ten reward percentages
    function setRewardDistribution(
        uint256 _taxPercent,
        uint256 _mainRewardPercent,
        uint256 _randomTenRewardPercent
    ) external onlyOwner {
        require(_taxPercent <= SCALE, "Tax percent cannot exceed 100%");
        require(_mainRewardPercent <= SCALE, "Main reward percent cannot exceed 100%");
        require(_randomTenRewardPercent <= SCALE, "Random Ten reward percent cannot exceed 100%");
        require(
            _taxPercent + _mainRewardPercent + _randomTenRewardPercent <= SCALE,
            "Tax + Main + Random Ten cannot exceed 100%"
        );

        TAX_PERCENT = _taxPercent;
        MAIN_REWARD_PERCENT = _mainRewardPercent;
        RANDOM_TEN_REWARD_PERCENT = _randomTenRewardPercent;
    }

    // Setter functions for other fee-related settings
    function setMegaJackpotFee(uint256 _megaJackpotFee) external onlyOwner {
        require(_megaJackpotFee <= SCALE, "Mega Jackpot fee cannot exceed 100%");
        MEGA_JACKPOT_FEE = _megaJackpotFee;
    }

    function setTeamSharePercent(uint256 _teamSharePercent) external onlyOwner {
        require(_teamSharePercent <= SCALE, "Team share percent cannot exceed 100%");
        TEAM_SHARE_PERCENT = _teamSharePercent;
    }

    // Setter functions for game settings
    function setEntryPrice(uint256 _entryPrice) external onlyOwner {
        require(_entryPrice > 0, "Entry price must be greater than 0");
        ENTRY_PRICE = _entryPrice;
    }

    function setJackpotSizeLimits(uint256 _minJackpotSize, uint256 _maxJackpotSize) external onlyOwner {
        require(_minJackpotSize > 0, "Min jackpot size must be greater than 0");
        require(_maxJackpotSize >= _minJackpotSize, "Max must be >= min");
        MIN_JACKPOT_SIZE = _minJackpotSize;
        MAX_JACKPOT_SIZE = _maxJackpotSize;
    }

    function setMaxMegaJackpot(uint256 _maxMegaJackpot) external onlyOwner {
        require(_maxMegaJackpot > 0, "Max Mega Jackpot must be greater than 0");
        MAX_MEGA_JACKPOT = _maxMegaJackpot;
    }

    // Getter function for jackpot size limits
    function getJackpotSizeLimits() external view returns (uint256, uint256) {
        return (MIN_JACKPOT_SIZE, MAX_JACKPOT_SIZE);
    }
}