const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LotteryGameNFTCard", function () {
  let owner, user1, user2, lotteryGameSigner;
  let nftCard;
  const BASE_URI = "https://example.com/metadata/";

  beforeEach(async function () {
    [owner, user1, user2, lotteryGameSigner] = await ethers.getSigners();

    // Deploy LotteryGameNFTCard
    const LotteryGameNFTCard = await ethers.getContractFactory("LotteryGameNFTCard");
    nftCard = await LotteryGameNFTCard.connect(owner).deploy(BASE_URI);
    await nftCard.waitForDeployment();

    // Set a mock lotteryGame address for testing
    await nftCard.connect(owner).setLotteryGame(lotteryGameSigner.address);
  });

  describe("Minting and Airdrop", function () {
    it("Should allow user to mint cards", async function () {
      await nftCard.connect(user1).mint(user1.address, 0, 1, { value: ethers.parseEther("0.5") });
      expect(await nftCard.balanceOf(user1.address, 0)).to.equal(1);
      expect(await nftCard.mintedCounts(0)).to.equal(1);
    });

    it("Should revert minting beyond supply limit", async function () {
      await nftCard.connect(user1).mint(user1.address, 0, 3, { value: ethers.parseEther("3") })
      await expect(
        nftCard.connect(user1).mint(user1.address, 0, 3, { value: ethers.parseEther("3") })
      ).to.be.revertedWith("Exceeds total supply for this card type");
    });

    it("Should revert minting with insufficient payment", async function () {
      await expect(
        nftCard.connect(user1).mint(user1.address, 0, 1, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should allow owner to airdrop cards", async function () {
      await nftCard.connect(owner).airdrop([user1.address, user2.address], 1, [1, 2]);
      expect(await nftCard.balanceOf(user1.address, 1)).to.equal(1);
      expect(await nftCard.balanceOf(user2.address, 1)).to.equal(2);
      expect(await nftCard.mintedCounts(1)).to.equal(3);
    });
  });

  describe("Locking and Unlocking", function () {
    beforeEach(async function () {
      await nftCard.connect(user1).mint(user1.address, 0, 2, { value: ethers.parseEther("1") });
      await nftCard.connect(user1).mint(user1.address, 1, 1, { value: ethers.parseEther("0.4") });
    });

    it("Should batch lock cards only by lotteryGame", async function () {
      const lotteryGameNFT = await ethers.getContractAt("LotteryGameNFTCard", nftCard.target, lotteryGameSigner);
      await expect(
        nftCard.connect(user1).batchLockCards(user1.address, [0, 1], [1, 1])
      ).to.be.revertedWith("Only LotteryGame can call this function");

      await lotteryGameNFT.batchLockCards(user1.address, [0, 1], [1, 1]);
      expect(await nftCard.lockedCards(user1.address, 0)).to.equal(1);
      expect(await nftCard.lockedCards(user1.address, 1)).to.equal(1);
    });

    it("Should batch unlock cards only by lotteryGame", async function () {
      const lotteryGameNFT = await ethers.getContractAt("LotteryGameNFTCard", nftCard.target, lotteryGameSigner);
      await lotteryGameNFT.batchLockCards(user1.address, [0, 1], [1, 1]);
      await expect(
        nftCard.connect(user1).batchUnlockCards(user1.address, [0, 1], [1, 1])
      ).to.be.revertedWith("Only LotteryGame can call this function");

      await lotteryGameNFT.batchUnlockCards(user1.address, [0, 1], [1, 1]);
      expect(await nftCard.lockedCards(user1.address, 0)).to.equal(0);
      expect(await nftCard.lockedCards(user1.address, 1)).to.equal(0);
    });

    it("Should revert locking more than available", async function () {
      const lotteryGameNFT = await ethers.getContractAt("LotteryGameNFTCard", nftCard.target, lotteryGameSigner);
      await expect(
        lotteryGameNFT.batchLockCards(user1.address, [0], [3])
      ).to.be.revertedWith("Not enough unlocked cards");
    });

    it("Should revert unlocking more than locked", async function () {
      const lotteryGameNFT = await ethers.getContractAt("LotteryGameNFTCard", nftCard.target, lotteryGameSigner);
      await lotteryGameNFT.batchLockCards(user1.address, [0], [1]);
      await expect(
        lotteryGameNFT.batchUnlockCards(user1.address, [0], [2])
      ).to.be.revertedWith("Not enough locked cards");
    });
  });

  describe("Boost Calculation", function () {
    it("Should calculate boost correctly", async function () {
      await nftCard.connect(user1).mint(user1.address, 0, 1, { value: ethers.parseEther("0.5") }); // Diamond: 60 boost
      await nftCard.connect(user1).mint(user1.address, 1, 2, { value: ethers.parseEther("0.8") }); // Platinum: 40 boost
      const boost = await nftCard.getBoost(user1.address, [0, 1], [1, 2]);
      expect(boost).to.equal(60 + 40 * 2); // 60 + 80 = 140
    });

    it("Should revert boost if not enough unlocked cards", async function () {
      const lotteryGameNFT = await ethers.getContractAt("LotteryGameNFTCard", nftCard.target, lotteryGameSigner);
      await nftCard.connect(user1).mint(user1.address, 0, 1, { value: ethers.parseEther("0.5") });
      await lotteryGameNFT.batchLockCards(user1.address, [0], [1]);
      await expect(
        nftCard.getBoost(user1.address, [0], [1])
      ).to.be.revertedWith("Not enough unlocked cards");
    });
  });

  describe("Transfer Restrictions", function () {
    beforeEach(async function () {
      await nftCard.connect(user1).mint(user1.address, 0, 2, { value: ethers.parseEther("1") });
    });

    it("Should prevent transfer of locked cards", async function () {
      const lotteryGameNFT = await ethers.getContractAt("LotteryGameNFTCard", nftCard.target, lotteryGameSigner);
      await lotteryGameNFT.batchLockCards(user1.address, [0], [1]);
      await expect(
        nftCard.connect(user1).safeTransferFrom(user1.address, user2.address, 0, 2, "0x")
      ).to.be.revertedWith("Cannot transfer locked cards");

      // Should allow transfer of remaining unlocked card
      await nftCard.connect(user1).safeTransferFrom(user1.address, user2.address, 0, 1, "0x");
      expect(await nftCard.balanceOf(user2.address, 0)).to.equal(1);
    });

    it("Should allow batch transfer of unlocked cards", async function () {
      await nftCard.connect(user1).mint(user1.address, 1, 1, { value: ethers.parseEther("0.4") });
      await nftCard.connect(user1).safeBatchTransferFrom(user1.address, user2.address, [0, 1], [2, 1], "0x");
      expect(await nftCard.balanceOf(user2.address, 0)).to.equal(2);
      expect(await nftCard.balanceOf(user2.address, 1)).to.equal(1);
    });
  });

  describe("Metadata and Admin Functions", function () {
    it("Should return correct metadata", async function () {
      expect(await nftCard.name()).to.equal("LotteryGameCard");
      expect(await nftCard.symbol()).to.equal("LGCard");
      expect(await nftCard.uri(0)).to.equal(`${BASE_URI}0.json`);
    });

    it("Should allow owner to set base URI", async function () {
      await nftCard.connect(owner).setBaseURI("https://newuri.com/");
      expect(await nftCard.uri(0)).to.equal("https://newuri.com/0.json");
    });

    it("Should allow owner to set token price", async function () {
      await nftCard.connect(owner).setTokenPrice(ethers.parseEther("1"), 0);
      await expect(
        nftCard.connect(user1).mint(user1.address, 0, 1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Insufficient payment");
      await nftCard.connect(user1).mint(user1.address, 0, 1, { value: ethers.parseEther("1") });
      expect(await nftCard.balanceOf(user1.address, 0)).to.equal(1);
    });
  });
});