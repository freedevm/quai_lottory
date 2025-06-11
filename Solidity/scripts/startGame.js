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
    
    // const cardContractAddress = await gameContractSigner.nftContract();
    // console.log("cardContractAddress", cardContractAddress);
    
    // const cardContractSigner = new quais.Contract(cardContractAddress, LotteryGameCardJson.abi, wallet)   
    // await cardContractSigner.setLotteryGame(process.env.lotteryGame);

    // const cardGameAddress = await cardContractSigner.lotteryGame();
    // console.log("cardGameAddress", cardGameAddress)

    const JackPotSize = ethers.parseEther('2');
    const txData = await gameContractSigner.startGame(JackPotSize);
    await txData.wait();
}

startGame()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })