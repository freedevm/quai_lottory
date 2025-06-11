const quais = require('quais')
const hre = require("hardhat");
const LotterySettingJson = require('../artifacts/contracts/LotterySetting.sol/LotterySetting.json')
require('dotenv').config()

async function main() {
    const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true })
    const wallet = new quais.Wallet(hre.network.config.accounts[0], provider)

    const settingContractSigner = new quais.Contract('0x004277f1f4909f4ac710BBC6056F298fa29cBbeC', LotterySettingJson.abi, wallet)   

    // Example settings
    const taxPercent = 1000; // 10%
    const mainRewardPercent = 8000; // 80%
    const randomTenRewardPercent = 1000; // 10%
    const megaJackpotFee = 5000; // 50%
    const teamSharePercent = 5000; // 50%
    const entryPrice = hre.ethers.parseEther("0.02"); // 0.05 ETH
    const minJackpotSize = hre.ethers.parseEther("0.1"); // 1 ETH
    const maxJackpotSize = hre.ethers.parseEther("10"); // 10 ETH
    const maxMegaJackpot = hre.ethers.parseEther("100"); // 100 ETH

    // console.log("Configuring reward distribution...");
    // let tx = await setting.setRewardDistribution(taxPercent, mainRewardPercent, randomTenRewardPercent);
    // await tx.wait();

    // console.log("Setting Mega Jackpot fee...");
    // tx = await setting.setMegaJackpotFee(megaJackpotFee);
    // await tx.wait();

    // console.log("Setting team share percent...");
    // tx = await setting.setTeamSharePercent(teamSharePercent);
    // await tx.wait();

    console.log("Setting entry price...", entryPrice);
    tx = await settingContractSigner.setEntryPrice(entryPrice);
    await tx.wait();

    console.log("Setting jackpot size limits...", minJackpotSize, maxJackpotSize);
    tx = await settingContractSigner.setJackpotSizeLimits(minJackpotSize, maxJackpotSize);
    await tx.wait();

    // console.log("Setting max Mega Jackpot...");
    // tx = await setting.setMaxMegaJackpot(maxMegaJackpot);
    // await tx.wait();

    console.log("Settings configured successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });