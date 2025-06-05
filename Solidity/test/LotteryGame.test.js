const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LotteryGame Full Test", function () {
  let owner, player1, player2, player3, teamWallet;
  let lotteryGame, nftCard, setting;
  let signers;
  const BASE_URI = "https://example.com/metadata/";

  beforeEach(async function () {
    signers = await ethers.getSigners();
    [owner, player1, player2, player3, teamWallet] = signers.slice(0, 5);

    const LotterySetting = await ethers.getContractFactory("LotterySetting");
    setting = await LotterySetting.connect(owner).deploy();
    await setting.waitForDeployment();
    await setting.connect(owner).setEntryPrice(ethers.parseEther("0.05"));

    const LotteryGameNFTCard = await ethers.getContractFactory("LotteryGameNFTCard");
    nftCard = await LotteryGameNFTCard.connect(owner).deploy(BASE_URI);
    await nftCard.waitForDeployment();

    const LotteryGame = await ethers.getContractFactory("LotteryGame");
    lotteryGame = await LotteryGame.connect(owner).deploy(
      nftCard.target,
      setting.target,
      teamWallet.address
    );
    await lotteryGame.waitForDeployment();

    await nftCard.connect(owner).setLotteryGame(lotteryGame.target);
  });

  describe("Game Creation and Ticket Purchase", function () {
    it("Should start a game and allow ticket purchase without NFTs", async function () {
      await lotteryGame.connect(owner).startGame(ethers.parseEther("1"));
      await lotteryGame.connect(player1).buyTickets(1, [], [], 123, { value: ethers.parseEther("0.05") });
      expect(await lotteryGame.getTickets(1, player1.address)).to.equal(1);
      expect(await lotteryGame.getGameCurrentSize(1)).to.equal(ethers.parseEther("0.05"));
    });

    it("Should allow ticket purchase with NFT boost and lock cards", async function () {
      await nftCard.connect(player1).mint(player1.address, 0, 2, { value: ethers.parseEther("1") });
      await lotteryGame.connect(owner).startGame(ethers.parseEther("1"));
      await lotteryGame.connect(player1).buyTickets(1, [0], [1], 123, { value: ethers.parseEther("0.05") });
      expect(await lotteryGame.getTickets(1, player1.address)).to.equal(60);
      expect(await nftCard.lockedCards(player1.address, 0)).to.equal(1);
      expect(await lotteryGame.getGameCurrentSize(1)).to.equal(ethers.parseEther("0.05"));
    });

    it("Should finish game when jackpot size is reached", async function () {
      await lotteryGame.connect(owner).startGame(ethers.parseEther("1"));
      for (let i = 0; i < 20; i++) {
        const signerGame = lotteryGame.connect(signers[i]);
        await signerGame.buyTickets(1, [], [], i, { value: ethers.parseEther("0.05") });
      }
      const game = await lotteryGame.games(1);
      expect(game.state).to.equal(1); // Finished
      expect(await lotteryGame.getGameCurrentSize(1)).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Reward Distribution", function () {
    it("Should distribute rewards and unlock NFTs", async function () {
      await nftCard.connect(player1).mint(player1.address, 0, 1, { value: ethers.parseEther("0.5") });
      await nftCard.connect(player2).mint(player2.address, 1, 1, { value: ethers.parseEther("0.4") });
      await lotteryGame.connect(owner).startGame(ethers.parseEther("1"));

      await lotteryGame.connect(owner).buyTickets(1, [], [], 123, { value: ethers.parseEther("0.05") });
      await lotteryGame.connect(player1).buyTickets(1, [0], [1], 123, { value: ethers.parseEther("0.05") });
      await lotteryGame.connect(player2).buyTickets(1, [1], [1], 456, { value: ethers.parseEther("0.05") });
      
      for (let i = 3; i < 20; i++) {
        const signerGame = lotteryGame.connect(signers[i]);
        await signerGame.buyTickets(1, [], [], i, { value: ethers.parseEther("0.05") });
      }

      const initialBalancePlayer1 = await ethers.provider.getBalance(player1.address);
      const initialBalanceTeam = await ethers.provider.getBalance(teamWallet.address);
      await lotteryGame.connect(owner).reward(1);

      const finalBalancePlayer1 = await ethers.provider.getBalance(player1.address);
      const finalBalanceTeam = await ethers.provider.getBalance(teamWallet.address);

      expect(finalBalancePlayer1).to.be.gt(initialBalancePlayer1);
      expect(finalBalanceTeam).to.be.gt(initialBalanceTeam);
      expect(await nftCard.lockedCards(player1.address, 0)).to.equal(0);
      expect(await nftCard.lockedCards(player2.address, 1)).to.equal(0);
      
      const game = await lotteryGame.games(1);
      expect(game.state).to.equal(3); // Rewarded
    });
  });

  describe("Mega Jackpot", function () {
    it("Should accumulate and refresh mega jackpot", async function () {
      await setting.connect(owner).setMaxMegaJackpot(ethers.parseEther("0.05"));
      await lotteryGame.connect(owner).startGame(ethers.parseEther("1"));
      for (let i = 0; i < 20; i++) {
        const signerGame = lotteryGame.connect(signers[i]);
        await signerGame.buyTickets(1, [], [], i, { value: ethers.parseEther("0.05") });
      }
      await lotteryGame.connect(owner).reward(1);

      const megaContribution = ethers.parseEther("1") * 1000n * 5000n / (10000n * 10000n); // 0.05 ETH
      expect(await lotteryGame.megaJackpot()).to.equal(megaContribution);

      const initialBalancePlayer1 = await ethers.provider.getBalance(player1.address);
      await lotteryGame.connect(owner).refreshMegaJackpot();
      const finalBalancePlayer1 = await ethers.provider.getBalance(player1.address);

      expect(await lotteryGame.megaJackpot()).to.equal(0);
      expect(finalBalancePlayer1).to.be.gte(initialBalancePlayer1); // Player1 might win
      expect(await lotteryGame.getInvestorList()).to.be.empty;
    });
  });

  describe("Emergency Withdraw", function () {
    it("Should allow owner to withdraw funds", async function () {
      await player1.sendTransaction({ to: lotteryGame.target, value: ethers.parseEther("1") });
      const initialBalance = await ethers.provider.getBalance(owner.address);
      await lotteryGame.connect(owner).emergencyWithdraw();
      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("View Functions", function () {
    it("Should return correct game data", async function () {
      await lotteryGame.connect(owner).startGame(ethers.parseEther("1"));
      await lotteryGame.connect(player1).buyTickets(1, [], [], 123, { value: ethers.parseEther("0.05") });
      expect(await lotteryGame.getTickets(1, player1.address)).to.equal(1);
      expect(await lotteryGame.getGameCurrentSize(1)).to.equal(ethers.parseEther("0.05"));
      expect(await lotteryGame.getActiveGameIndices()).to.deep.equal([1n]);
      expect(await lotteryGame.getInvestorList()).to.deep.equal([player1.address]);
    });
  });

  describe("Edge Cases", function () {
    it("Should revert buying tickets twice", async function () {
      await lotteryGame.connect(owner).startGame(ethers.parseEther("1"));
      await lotteryGame.connect(player1).buyTickets(1, [], [], 123, { value: ethers.parseEther("0.05") });
      await expect(
        lotteryGame.connect(player1).buyTickets(1, [], [], 456, { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Invalid input or entry");
    });

    it("Should revert reward on non-finished game", async function () {
      await lotteryGame.connect(owner).startGame(ethers.parseEther("1"));
      await expect(
        lotteryGame.connect(owner).reward(1)
      ).to.be.revertedWith("Game not in Finished state");
    });
  });
});