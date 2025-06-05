const quais = require('quais')
const LotterySetting = require('../artifacts/contracts/LotterySetting.sol/LotterySetting.json')
const { deployMetadata } = require("hardhat");
require('dotenv').config()

// Pull contract arguments from .env
const args = []

async function deploySetting() {
  // Config provider, wallet, and contract factory
  const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true })
  const wallet = new quais.Wallet(hre.network.config.accounts[0], provider)
  const ipfsHash = await deployMetadata.pushMetadataToIPFS("LotterySetting")
  const Setting = new quais.ContractFactory(LotterySetting.abi, LotterySetting.bytecode, wallet, ipfsHash)

  // Broadcast deploy transaction
  const setting = await Setting.deploy()
  console.log('Transaction broadcasted: ', setting.deploymentTransaction().hash)

  // Wait for contract to be deployed
  await setting.waitForDeployment()
  console.log('Contract deployed to: ', await setting.getAddress())
}

deploySetting()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
