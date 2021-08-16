const { BigNumber } = require("@ethersproject/bignumber");
const MonsterChef = artifacts.require("MonsterChef");
const MonsterToken = artifacts.require("MonsterToken");
const Daikaiju = artifacts.require("Daikaiju");
const MultiCall = artifacts.require("MultiCall");
const Timelock = artifacts.require("Timelock");

const INITIAL_MINT = "15000"; // Pre-Mint 15,000 token
const BLOCKS_PER_HOUR = 3600 / 3; // 3sec Block Time
const TOKENS_PER_BLOCK = "11.5";
const TIMELOCK_DELAY_SECS = 3600 * 24; // 24 Hours delay
const STARTING_BLOCK = 4853714; // Unknown
const REWARDS_START = String(STARTING_BLOCK + BLOCKS_PER_HOUR * 6);
const FARM_FEE_ACCOUNT = "0xa6a4b15419F911B2C24d39329AbEa5532153dd65";
const DEV_ADDR_ACCOUNT = "0xa6a4b15419F911B2C24d39329AbEa5532153dd65";

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
  let daikaijuInstance;
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
    .then((tx) => {
      logTx(tx);
      /**
       * Deploy Daikaiju
       */
      return deployer.deploy(Daikaiju, MonsterToken.address);
    })
    .then((instance) => {
      daikaijuInstance = instance;
      /**
       * Deploy MonsterChef
       */
      if (network == "bsc" || network == "bsc-fork") {
        console.log(`Deploying MonsterChef with BSC MAINNET settings.`);
        return deployer.deploy(
          MonsterChef,
          MonsterToken.address, // _kaijutoken
          Daikaiju.address, // _daikaiju
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
        Daikaiju.address,
        feeAccount,
        BigNumber.from(TOKENS_PER_BLOCK).mul(BigNumber.from(String(10 ** 18))),
        0,
        4
      );
    })
    .then((instance) => {
      monsterChefInstance = instance;
      /**
       * TransferOwnership of KAIJU to MonsterChef
       */
      return kaijuTokenInstance.transferOwnership(MonsterChef.address);
    })
    .then((tx) => {
      logTx(tx);
      /**
       * TransferOwnership of DaiKaiju to MonsterChef
       */
      return daikaijuInstance.transferOwnership(MonsterChef.address);
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
      return deployer.deploy(Timelock, currentAccount, TIMELOCK_DELAY_SECS);
    })
    .then(() => {
      console.log("Rewards Start at block: ", REWARDS_START);
      console.table({
        MonsterChef: MonsterChef.address,
        MonsterToken: MonsterToken.address,
        Daikaiju: Daikaiju.address,
        MultiCall: MultiCall.address,
        Timelock: Timelock.address,
      });
    });
};
