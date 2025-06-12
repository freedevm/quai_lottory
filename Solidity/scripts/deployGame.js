const quais = require('quais')
const LotteryGameJson = require('../artifacts/contracts/LotteryGame.sol/LotteryGame.json')
const LotteryGameCardJson = require('../artifacts/contracts/LotteryGameNFTCard.sol/LotteryGameNFTCard.json')
const { deployMetadata } = require("hardhat");
require('dotenv').config()

// Pull contract arguments from .env
const tokenArgs = [process.env.lotteryGameNFTCard, process.env.lotterySetting, '0x001699Eed9230d3799245300A4993cCd8bac2706']

async function deployLotteryGame() {
  // Config provider, wallet, and contract factory
  const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true })
  const wallet = new quais.Wallet(hre.network.config.accounts[0], provider)
  const ipfsHash = await deployMetadata.pushMetadataToIPFS("LotteryGame")
  const LotteryGame = new quais.ContractFactory(LotteryGameJson.abi, LotteryGameJson.bytecode, wallet, ipfsHash)

  // Broadcast deploy transaction
  const game = await LotteryGame.deploy(...tokenArgs)
  console.log('Transaction broadcasted: ', game.deploymentTransaction().hash)

  // Wait for contract to be deployed
  await game.waitForDeployment()
  console.log('Contract deployed to: ', await game.getAddress())

  const GameAddress = await game.getAddress();

  const cardContractSigner = new quais.Contract(process.env.lotteryGameNFTCard, LotteryGameCardJson.abi, wallet)   
  const txHash = await cardContractSigner.setLotteryGame(GameAddress);
  await txHash.wait();
  
  const cardGameAddress = await cardContractSigner.lotteryGame();
  console.log("cardGameAddress", cardGameAddress)
}

deployLotteryGame()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
