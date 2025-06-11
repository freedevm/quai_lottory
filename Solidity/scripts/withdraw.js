const quais = require('quais')
const LotteryGameJson = require('../artifacts/contracts/LotteryGame.sol/LotteryGame.json')
const { deployMetadata, ethers } = require("hardhat");
require('dotenv').config()

async function withdrawGame() {
    // Config provider, wallet, and contract factory
    const provider = new quais.JsonRpcProvider(hre.network.config.url, undefined, { usePathing: true })
    const wallet = new quais.Wallet(hre.network.config.accounts[0], provider)
    const beforeBalance = await provider.getBalance(wallet.address);
    console.log("beforeBalance", beforeBalance);

    const gameContractSigner = new quais.Contract('0x00716592DbFE0507D54f073D3a75C8F157964999', LotteryGameJson.abi, wallet)

    const withdrawTx = await gameContractSigner.emergencyWithdraw();
    console.log("withdrawTx", withdrawTx);

    await withdrawTx.wait();
    const afterBalance = await provider.getBalance(wallet.address);
    console.log("afterBalance", afterBalance);
}

withdrawGame()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })