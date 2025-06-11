const quais = require('quais')
const LotteryGameJson = require('../artifacts/contracts/LotteryGame.sol/LotteryGame.json')
const LotteryGameCardJson = require('../artifacts/contracts/LotteryGameNFTCard.sol/LotteryGameNFTCard.json')
const { deployMetadata, ethers } = require("hardhat");

require('dotenv').config()

async function startGame() {
    // Config provider, wallet, and contract factory
    const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true })
    const wallet = new quais.Wallet(hre.network.config.accounts[0], provider)
    const balance = await provider.getBalance(wallet.address);

    const gameContractSigner = new quais.Contract(process.env.lotteryGame, LotteryGameJson.abi, wallet)
    
    const GameIndex = 1;
    const txData = await gameContractSigner.reward(GameIndex);
    await txData.wait();
}

startGame()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })