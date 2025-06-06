const quais = require('quais')
const LotteryGameJson = require('../artifacts/contracts/LotteryGame.sol/LotteryGame.json')
const { deployMetadata } = require("hardhat");
require('dotenv').config()

// Pull contract arguments from .env
const tokenArgs = ['0x004277f1f4909f4ac710BBC6056F298fa29cBbeC', '0x004F95fa7874B0b982eF945Eeef22E5b64BDFDcE', '0x001699Eed9230d3799245300A4993cCd8bac2706']

async function deployERC20() {
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
}

deployERC20()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
