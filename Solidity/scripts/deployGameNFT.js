const quais = require('quais')
const LotteryGameNFTCard = require('../artifacts/contracts/LotteryGameNFTCard.sol/LotteryGameNFTCard.json')
const { deployMetadata } = require("hardhat");
require('dotenv').config()

// Pull contract arguments from .env
const args = [process.env.QRC721_BASE_URI]

async function deployLotteryGameNFT() {
  // Config provider, wallet, and contract factory
  const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true })
  const wallet = new quais.Wallet(hre.network.config.accounts[0], provider)
  const ipfsHash = await deployMetadata.pushMetadataToIPFS("LotteryGameNFTCard")
  const LotteryGameNFT = new quais.ContractFactory(LotteryGameNFTCard.abi, LotteryGameNFTCard.bytecode, wallet, ipfsHash)

  // Broadcast deploy transaction
  const gameNFT = await LotteryGameNFT.deploy(...args)
  console.log('Transaction broadcasted: ', gameNFT.deploymentTransaction().hash)

  // Wait for contract to be deployed
  await gameNFT.waitForDeployment()
  console.log('Contract deployed to: ', await gameNFT.getAddress())
}

deployLotteryGameNFT()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
