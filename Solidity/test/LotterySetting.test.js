const { expect } = require("chai");
const quais = require('quais')
const { ethers } = require("hardhat");

describe("LotterySetting", function () {
  let LotterySetting;
  let setting;
  let owner, nonOwner;

  const SCALE = 10000;
  const INITIAL_TAX_PERCENT = 1000; // 10%
  const INITIAL_MEGA_JACKPOT_FEE = 5000; // 50%
  const INITIAL_MAIN_REWARD_PERCENT = 8000; // 80%
  const INITIAL_RANDOM_TEN_REWARD_PERCENT = 1000; // 10%
  const INITIAL_TEAM_SHARE_PERCENT = 5000; // 50%
  const INITIAL_ENTRY_PRICE = ethers.parseEther("0.05");
  const INITIAL_MIN_JACKPOT_SIZE = ethers.parseEther("1");
  const INITIAL_MAX_JACKPOT_SIZE = ethers.parseEther("10");
  const INITIAL_MAX_MEGA_JACKPOT = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, nonOwner] = await quais.getSigners();

    LotterySetting = await quais.getContractFactory("LotterySetting");
    setting = await LotterySetting.deploy();
    await setting.waitForDeployment();
  });

  it("Should deploy with correct initial state", async function () {
    expect(await setting.SCALE()).to.equal(SCALE);
    expect(await setting.TAX_PERCENT()).to.equal(INITIAL_TAX_PERCENT);
    expect(await setting.MEGA_JACKPOT_FEE()).to.equal(INITIAL_MEGA_JACKPOT_FEE);
    expect(await setting.MAIN_REWARD_PERCENT()).to.equal(INITIAL_MAIN_REWARD_PERCENT);
    expect(await setting.RANDOM_TEN_REWARD_PERCENT()).to.equal(INITIAL_RANDOM_TEN_REWARD_PERCENT);
    expect(await setting.TEAM_SHARE_PERCENT()).to.equal(INITIAL_TEAM_SHARE_PERCENT);
    expect(await setting.ENTRY_PRICE()).to.equal(INITIAL_ENTRY_PRICE);
    expect(await setting.MIN_JACKPOT_SIZE()).to.equal(INITIAL_MIN_JACKPOT_SIZE);
    expect(await setting.MAX_JACKPOT_SIZE()).to.equal(INITIAL_MAX_JACKPOT_SIZE);
    expect(await setting.MAX_MEGA_JACKPOT()).to.equal(INITIAL_MAX_MEGA_JACKPOT);
    expect(await setting.owner()).to.equal(owner.address);

    const [minJackpotSize, maxJackpotSize] = await setting.getJackpotSizeLimits();
    expect(minJackpotSize).to.equal(INITIAL_MIN_JACKPOT_SIZE);
    expect(maxJackpotSize).to.equal(INITIAL_MAX_JACKPOT_SIZE);
  });

  it("Should allow owner to set reward distribution", async function () {
    const newTaxPercent = 1500; // 15%
    const newMainRewardPercent = 7500; // 75%
    const newRandomTenRewardPercent = 1000; // 10%
    await setting.setRewardDistribution(newTaxPercent, newMainRewardPercent, newRandomTenRewardPercent);

    expect(await setting.TAX_PERCENT()).to.equal(newTaxPercent);
    expect(await setting.MAIN_REWARD_PERCENT()).to.equal(newMainRewardPercent);
    expect(await setting.RANDOM_TEN_REWARD_PERCENT()).to.equal(newRandomTenRewardPercent);
  });

  it("Should fail to set reward distribution if not owner", async function () {
    const newTaxPercent = 1500;
    const newMainRewardPercent = 7500;
    const newRandomTenRewardPercent = 1000;
    await expect(
      setting
        .connect(nonOwner)
        .setRewardDistribution(newTaxPercent, newMainRewardPercent, newRandomTenRewardPercent)
    ).to.be.revertedWithCustomError(setting, "OwnableUnauthorizedAccount");
  });

  it("Should fail to set reward distribution if tax percent exceeds 100%", async function () {
    const invalidTaxPercent = SCALE + 1; // 100.01%
    const mainRewardPercent = 8000;
    const randomTenRewardPercent = 1000;
    await expect(
      setting.setRewardDistribution(invalidTaxPercent, mainRewardPercent, randomTenRewardPercent)
    ).to.be.revertedWith("Tax percent cannot exceed 100%");
  });

  it("Should fail to set reward distribution if main reward percent exceeds 100%", async function () {
    const taxPercent = 1000;
    const invalidMainRewardPercent = SCALE + 1; // 100.01%
    const randomTenRewardPercent = 1000;
    await expect(
      setting.setRewardDistribution(taxPercent, invalidMainRewardPercent, randomTenRewardPercent)
    ).to.be.revertedWith("Main reward percent cannot exceed 100%");
  });

  it("Should fail to set reward distribution if random ten reward percent exceeds 100%", async function () {
    const taxPercent = 1000;
    const mainRewardPercent = 8000;
    const invalidRandomTenRewardPercent = SCALE + 1; // 100.01%
    await expect(
      setting.setRewardDistribution(taxPercent, mainRewardPercent, invalidRandomTenRewardPercent)
    ).to.be.revertedWith("Random Ten reward percent cannot exceed 100%");
  });

  it("Should fail to set reward distribution if sum exceeds 100%", async function () {
    const taxPercent = 1500; // 15%
    const mainRewardPercent = 8000; // 80%
    const randomTenRewardPercent = 1000; // 10%
    // Total = 15% + 80% + 10% = 105%
    await expect(
      setting.setRewardDistribution(taxPercent, mainRewardPercent, randomTenRewardPercent)
    ).to.be.revertedWith("Tax + Main + Random Ten cannot exceed 100%");
  });

  it("Should allow owner to set Mega Jackpot fee", async function () {
    const newMegaJackpotFee = 6000; // 60%
    await setting.setMegaJackpotFee(newMegaJackpotFee);
    expect(await setting.MEGA_JACKPOT_FEE()).to.equal(newMegaJackpotFee);
  });

  it("Should fail to set Mega Jackpot fee if not owner", async function () {
    const newMegaJackpotFee = 6000;
    await expect(
      setting.connect(nonOwner).setMegaJackpotFee(newMegaJackpotFee)
    ).to.be.revertedWithCustomError(setting, "OwnableUnauthorizedAccount");
  });

  it("Should fail to set Mega Jackpot fee if exceeds 100%", async function () {
    const invalidMegaJackpotFee = SCALE + 1; // 100.01%
    await expect(setting.setMegaJackpotFee(invalidMegaJackpotFee)).to.be.revertedWith(
      "Mega Jackpot fee cannot exceed 100%"
    );
  });

  it("Should allow owner to set team share percent", async function () {
    const newTeamSharePercent = 4000; // 40%
    await setting.setTeamSharePercent(newTeamSharePercent);
    expect(await setting.TEAM_SHARE_PERCENT()).to.equal(newTeamSharePercent);
  });

  it("Should fail to set team share percent if not owner", async function () {
    const newTeamSharePercent = 4000;
    await expect(
      setting.connect(nonOwner).setTeamSharePercent(newTeamSharePercent)
    ).to.be.revertedWithCustomError(setting, "OwnableUnauthorizedAccount");
  });

  it("Should fail to set team share percent if exceeds 100%", async function () {
    const invalidTeamSharePercent = SCALE + 1; // 100.01%
    await expect(setting.setTeamSharePercent(invalidTeamSharePercent)).to.be.revertedWith(
      "Team share percent cannot exceed 100%"
    );
  });

  it("Should allow owner to set entry price", async function () {
    const newEntryPrice = ethers.parseEther("0.1");
    await setting.setEntryPrice(newEntryPrice);
    expect(await setting.ENTRY_PRICE()).to.equal(newEntryPrice);
  });

  it("Should fail to set entry price if not owner", async function () {
    const newEntryPrice = ethers.parseEther("0.1");
    await expect(
      setting.connect(nonOwner).setEntryPrice(newEntryPrice)
    ).to.be.revertedWithCustomError(setting, "OwnableUnauthorizedAccount");
  });

  it("Should fail to set entry price to 0", async function () {
    await expect(setting.setEntryPrice(0)).to.be.revertedWith("Entry price must be greater than 0");
  });

  it("Should allow owner to set jackpot size limits", async function () {
    const newMinJackpotSize = ethers.parseEther("2");
    const newMaxJackpotSize = ethers.parseEther("20");
    await setting.setJackpotSizeLimits(newMinJackpotSize, newMaxJackpotSize);
    expect(await setting.MIN_JACKPOT_SIZE()).to.equal(newMinJackpotSize);
    expect(await setting.MAX_JACKPOT_SIZE()).to.equal(newMaxJackpotSize);

    const [minJackpotSize, maxJackpotSize] = await setting.getJackpotSizeLimits();
    expect(minJackpotSize).to.equal(newMinJackpotSize);
    expect(maxJackpotSize).to.equal(newMaxJackpotSize);
  });

  it("Should fail to set jackpot size limits if not owner", async function () {
    const newMinJackpotSize = ethers.parseEther("2");
    const newMaxJackpotSize = ethers.parseEther("20");
    await expect(
      setting.connect(nonOwner).setJackpotSizeLimits(newMinJackpotSize, newMaxJackpotSize)
    ).to.be.revertedWithCustomError(setting, "OwnableUnauthorizedAccount");
  });

  it("Should fail to set jackpot size limits if min is 0", async function () {
    const newMinJackpotSize = 0;
    const newMaxJackpotSize = ethers.parseEther("20");
    await expect(
      setting.setJackpotSizeLimits(newMinJackpotSize, newMaxJackpotSize)
    ).to.be.revertedWith("Min jackpot size must be greater than 0");
  });

  it("Should fail to set jackpot size limits if max is less than min", async function () {
    const newMinJackpotSize = ethers.parseEther("20");
    const newMaxJackpotSize = ethers.parseEther("2");
    await expect(
      setting.setJackpotSizeLimits(newMinJackpotSize, newMaxJackpotSize)
    ).to.be.revertedWith("Max must be >= min");
  });

  it("Should allow owner to set max Mega Jackpot", async function () {
    const newMaxMegaJackpot = ethers.parseEther("200");
    await setting.setMaxMegaJackpot(newMaxMegaJackpot);
    expect(await setting.MAX_MEGA_JACKPOT()).to.equal(newMaxMegaJackpot);
  });

  it("Should fail to set max Mega Jackpot if not owner", async function () {
    const newMaxMegaJackpot = ethers.parseEther("200");
    await expect(
      setting.connect(nonOwner).setMaxMegaJackpot(newMaxMegaJackpot)
    ).to.be.revertedWithCustomError(setting, "OwnableUnauthorizedAccount");
  });

  it("Should fail to set max Mega Jackpot to 0", async function () {
    await expect(setting.setMaxMegaJackpot(0)).to.be.revertedWith(
      "Max Mega Jackpot must be greater than 0"
    );
  });
});