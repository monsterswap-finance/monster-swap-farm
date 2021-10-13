const { BigNumber } = require("@ethersproject/bignumber");
const MonsterChef = artifacts.require("MonsterChef");
const MonsterToken = artifacts.require("MonsterToken");
const MonsterDai =  artifacts.require("MonsterDai");
const MultiCall = artifacts.require("MultiCall");
const Timelock = artifacts.require("Timelock");

const INITIAL_MINT = "15000"; // Pre-Mint 15,000 token
const BLOCKS_PER_MINUTE = 40;
const BLOCKS_PER_HOUR = (BLOCKS_PER_MINUTE * 60); // 3sec Block Time
const TOKENS_PER_BLOCK = "12";
const TIMELOCK_DELAY_SECS = 3600 * 24; // 24 Hours delay
const STARTING_BLOCK = 18986520; // GET FROM BSC
const REWARDS_START = String(STARTING_BLOCK + BLOCKS_PER_HOUR * 1);
const FARM_FEE_ACCOUNT = "0x47280B36AC4C3D30db6a7007D7D7880d30aEea18";
const DEV_ADDR_ACCOUNT = "0xeD78a08c1a8d32549cA15FDD30CEcdA884547F6A";

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
  let MonsterDaiInstance;
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
      /**
       * Deploy MonsterDai
       */
      return deployer.deploy(MonsterDai, MonsterToken.address);
    })
    .then((instance) => {
      MonsterDaiInstance = instance
      /**
       * Deploy MonsterChef
       */
      if (network == "bsc" || network == "bsc-fork") {
        console.log(`Deploying MonsterChef with BSC MAINNET settings.`);
        return deployer.deploy(
          MonsterChef,
          MonsterDai.address, //_MonsterDai
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
        MonsterDai.address, //_MonsterDai
        DEV_ADDR_ACCOUNT, // _devAddr
        FARM_FEE_ACCOUNT, // _feeAddr
        BigNumber.from(TOKENS_PER_BLOCK).mul(BigNumber.from(String(10 ** 18))),
        REWARDS_START,
        1
      );
    })
    .then((instance) => {
      monsterChefInstance = instance;
      /**
       * TransferOwnership of KAIJU to MonsterChef
       */
      return MonsterTokenInstance.transferOwnership(MonsterChef.address);
    })
    .then((tx) => {
      // logTx(tx);
      /**
       * TransferOwnership of MONSTERDAI to MonsterChef
       */
      return MonsterDaiInstance.transferOwnership(MonsterChef.address);
    })
    //################################################################
    //### MANUAL-DISABLED (MULTICALL)
    .then(() => {
      /**
       * Deploy MultiCall
       */
      return deployer.deploy(MultiCall);
    })
    //################################################################

    //################################################################
    //### MANUAL-DISABLED (TIMELOCK)
    // .then(() => {
    //   /**
    //    * Deploy Timelock
    //    */
    //   return deployer.deploy(Timelock, DEV_ADDR_ACCOUNT, TIMELOCK_DELAY_SECS);
    // })    
    //################################################################

    //################################################################
    //### MANUAL-DISABLED (TRANSFER-TO-TIMELOCK)
    // .then(() => {
    //   /**
    //    * TransferOwnership of MonsterChef to TimeLock Contract
    //    */
    //   return monsterChefInstance.transferOwnership(Timelock.address);
    // })    
    //################################################################
    .then(() => {
      console.log("Rewards Start at block: ", REWARDS_START);
      console.table({
        MonsterChef: MonsterChef.address,
        MonsterToken: MonsterToken.address,
        MonsterDai: MonsterDai.address,
        MultiCall: MultiCall.address,
        Timelock: Timelock.address,
      });
    });
};
