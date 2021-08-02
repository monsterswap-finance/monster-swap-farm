const { BigNumber } = require("@ethersproject/bignumber");
const MonsterChef = artifacts.require("MonsterChef");
// const SupportApe = artifacts.require("SupportApe");
const KaijuToken = artifacts.require("KaijuToken");
const Daikaiju = artifacts.require("Daikaiju");
const MultiCall = artifacts.require("MultiCall");
const Timelock = artifacts.require("Timelock");

const INITIAL_MINT = "25000";
const BLOCKS_PER_HOUR = 3600 / 3; // 3sec Block Time
const TOKENS_PER_BLOCK = "10";
const BLOCKS_PER_DAY = 24 * BLOCKS_PER_HOUR;
const TIMELOCK_DELAY_SECS = 3600 * 24;
const STARTING_BLOCK = 4853714;
const REWARDS_START = String(STARTING_BLOCK + BLOCKS_PER_HOUR * 6);
const FARM_FEE_ACCOUNT = "0xCEf34e4db130c8A64493517985b23af5B13E8cc6";

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

  let kaijuTokenInstance;
  let daikaijuInstance;
  let monsterChefInstance;

  /**
   * Deploy KaijuToken
   */
  deployer
    .deploy(KaijuToken)
    .then((instance) => {
      kaijuTokenInstance = instance;
      /**
       * Mint intial tokens for liquidity pool
       */
      return kaijuTokenInstance.mint(
        BigNumber.from(INITIAL_MINT).mul(BigNumber.from(String(10 ** 18)))
      );
    })
    .then((tx) => {
      logTx(tx);
      /**
       * Deploy Daikaiju
       */
      return deployer.deploy(Daikaiju, KaijuToken.address);
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
          KaijuToken.address, // _kaijutoken
          Daikaiju.address, // _daikaiju
          feeAccount, // _devaddr
          BigNumber.from(TOKENS_PER_BLOCK).mul(
            BigNumber.from(String(10 ** 18))
          ), // _bananaPerBlock
          REWARDS_START, // _startBlock
          4 // _multiplier
        );
      }
      console.log(`Deploying MonsterChef with DEV/TEST settings`);
      return deployer.deploy(
        MonsterChef,
        KaijuToken.address,
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
    // .then((tx) => {
    //   logTx(tx);
    //   /**
    //    * Deploy SupportApe
    //    */
    //   if (network == "bsc" || network == "bsc-fork") {
    //     console.log(`Deploying SupportApe with BSC MAINNET settings.`);
    //     return deployer.deploy(
    //       SupportApe,
    //       Daikaiju.address, //_daikaiju
    //       BigNumber.from(TOKENS_PER_BLOCK).mul(
    //         BigNumber.from(String(10 ** 18))
    //       ), // _rewardPerBlock
    //       REWARDS_START, // _startBlock
    //       STARTING_BLOCK + BLOCKS_PER_DAY * 365 // _endBlock
    //     );
    //   }
    //   console.log(`Deploying SupportApe with DEV/TEST settings`);
    //   return deployer.deploy(
    //     SupportApe,
    //     Daikaiju.address, //_daikaiju
    //     BigNumber.from(TOKENS_PER_BLOCK).mul(BigNumber.from(String(10 ** 18))), // _rewardPerBlock
    //     STARTING_BLOCK + BLOCKS_PER_HOUR * 6, // _startBlock
    //     "99999999999999999" // _endBlock
    //   );
    // })
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
        KaijuToken: KaijuToken.address,
        Daikaiju: Daikaiju.address,
        MultiCall: MultiCall.address,
        Timelock: Timelock.address,
      });
    });
};
