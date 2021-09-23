const { BigNumber } = require("@ethersproject/bignumber");
const MonsterChef = artifacts.require("MonsterChef");
const MonsterToken = artifacts.require("MonsterToken");
const MultiCall = artifacts.require("MultiCall");
const Timelock = artifacts.require("Timelock");

const INITIAL_MINT = "15000"; // Pre-Mint 15,000 token
const BLOCKS_PER_HOUR = 3600 / 3; // 3sec Block Time
const TOKENS_PER_BLOCK = "12";
const TIMELOCK_DELAY_SECS = 3600 * 24; // 24 Hours delay
const STARTING_BLOCK = 12620422; // GET FROM BSC
const REWARDS_START = String(STARTING_BLOCK + BLOCKS_PER_HOUR * 1);
const FARM_FEE_ACCOUNT = "0x10E138a3Fd2a2705bcc7Aff5824d6029FBc83AB5";
const DEV_ADDR_ACCOUNT = "0x10E138a3Fd2a2705bcc7Aff5824d6029FBc83AB5";

const logTx = (tx) => {
  console.dir(tx, { depth: 3 });
};

// let block = await web3.eth.getBlock("latest")
module.exports = async function (deployer, network, accounts) {
  console.log({ network });

  let currentAccount = accounts[0];
  let feeAccount = FARM_FEE_ACCOUNT;
  if (network == "testnet") {
    console.log(`WARNING: Updating current account for testnet`);
    currentAccount = accounts[1];
  }

  if (network == "development" || network == "testnet") {
    console.log(`WARNING: Updating feeAcount for testnet/development`);
    feeAccount = accounts[3];
  }

  let MonsterTokenInstance;
  let monsterChefInstance;

  /**
   * Deploy MonsterToken
   */
  deployer
    .deploy(MonsterToken)
    .then((instance) => {
      MonsterTokenInstance = instance;
      /**
       * Mint intial tokens for liquidity pool
       */
      return MonsterTokenInstance.mint(
        BigNumber.from(INITIAL_MINT).mul(BigNumber.from(String(10 ** 18)))
      );
    })
    .then(() => {
      /**
       * Deploy MonsterChef
       */
      if (network == "bsc" || network == "bsc-fork") {
        console.log(`Deploying MonsterChef with BSC MAINNET settings.`);
        return deployer.deploy(
          MonsterChef,
          MonsterToken.address, // _monsterToken
          DEV_ADDR_ACCOUNT, // _devAddr
          FARM_FEE_ACCOUNT, // _feeAddr
          BigNumber.from(TOKENS_PER_BLOCK).mul(
            BigNumber.from(String(10 ** 18))
          ), // _MonsterPerBlock
          REWARDS_START, // _startBlock
          4 // _multiplier
        );
      }
      console.log(`Deploying MonsterChef with DEV/TEST settings`);
      return deployer.deploy(
        MonsterChef,
        MonsterToken.address,
        DEV_ADDR_ACCOUNT, // _devAddr
        FARM_FEE_ACCOUNT, // _feeAddr
        BigNumber.from(TOKENS_PER_BLOCK).mul(BigNumber.from(String(10 ** 18))),
        REWARDS_START,
        4
      );
    })
    .then((instance) => {
      monsterChefInstance = instance;
      /**
       * TransferOwnership of KAIJU to MonsterChef
       */
      return MonsterTokenInstance.transferOwnership(MonsterChef.address);
    })
    .then(() => {
      /**
       * Deploy MultiCall
       */
      return deployer.deploy(MultiCall);
    })
    .then(() => {
      /**
       * Deploy Timelock
       */
      return deployer.deploy(Timelock, DEV_ADDR_ACCOUNT, TIMELOCK_DELAY_SECS);
    })
    // .then(() => {
    //   /**
    //    * TransferOwnership of MonsterChef to TimeLock Contract
    //    */
    //   return monsterChefInstance.transferOwnership(Timelock.address);
    // })
    .then(() => {
      console.log("Rewards Start at block: ", REWARDS_START);
      console.table({
        MonsterChef: MonsterChef.address,
        MonsterToken: MonsterToken.address,
        MultiCall: MultiCall.address,
        Timelock: Timelock.address,
      });
    });
};
