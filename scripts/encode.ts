import { writeJSONToFile } from "./helpers/files";
import { Contract } from "@ethersproject/contracts";

// Encode Timelock Transactions
import MonsterChef from "../build/contracts/MonsterChef.json";
import Timelock from "../build/contracts/Timelock.json";

// Find timestamp based on a date
// const dateTimestamp = Math.floor(+new Date('March 12, 2021 19:00:00') / 1000)

const DEFAULT_OFFSET = 3600 * 24.5;
const getTimestamp = (offsetSeconds = 0): number => {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  return currentTimestamp + offsetSeconds;
};

/*
 * TESTNET or MAINNET?
 */
// TESTNET
const MONSTER_CHEF_ADDRESS = "0xd40c4dAb02B6dab6C36c91EeD52E15199c5ba020";
const TIMELOCK_ADDRESS = "0x1cab57dd8ba569574fafc68e97f474f52a66d7db";
// MAINNET
// const MASTER_APE_ADDRESS = "0x5c8D727b265DBAfaba67E050f2f739cAeEB4A6F9";
// const TIMELOCK_ADDRESS = "0x2F07969090a2E9247C761747EA2358E5bB033460";

const MonsterChefContract = new Contract(MONSTER_CHEF_ADDRESS, MonsterChef.abi);
const timelockContract = new Contract(TIMELOCK_ADDRESS, Timelock.abi);

const encode = async () => {
  /*
   * General use MasterApe functions
   */

  /**
   * Update the multiplier of BANANA minted per block
   * updateMultiplier(uint256 multiplierNumber)
   */
  // const ETA = getTimestamp(DEFAULT_OFFSET);
  // const method = 'updateMultiplier';
  // const masterApeTXEncodeFunction = masterApeContract.populateTransaction[method];
  // const masterApeArgsArray = [[1]];

  /**
   * Update a farm multiplier by the pid (pool id)
   * set(uint256 _pid, uint256 _allocPoint, bool _withUpdate)
   */

  //  BNB/DOGE LP (pid38 200-[100]) 0xfd1ef328A17A8e8Eeaf7e4Ea1ed8a108E1F2d096
  //  BNB/LTC LP (pid39 200-[100]) 0x0F12362c017Fe5101c7bBa09390f1CB729f5B318

  // // const ETA = getTimestamp(DEFAULT_OFFSET + (3600 * 24 * 2));
  // const ETA = getTimestamp(DEFAULT_OFFSET);
  // const method = 'set';
  // const masterApeTXEncodeFunction = masterApeContract.populateTransaction[method];
  // const masterApeArgsArray = [
  //     [43, 0, false],
  // ]

  /**
   * Add a new farm to MasterApe
   * add(uint256 _allocPoint, IBEP20 _lpToken, bool _withUpdate)
   */
  const ETA = getTimestamp(DEFAULT_OFFSET);
  const method = "add";
  const MonsterChefTXEncodeFunction =
    MonsterChefContract.populateTransaction[method];
  const MonsterArgsArray = [
    [500, "0x8c283557a0db777c628a533d9b562281dad6f173", 1, 1, false],
  ];

  let outputs = [];

  for (const masterApeArgs of MonsterArgsArray) {
    /**
     * Encode child tx
     */
    const masterApeTXEncoded = await MonsterChefTXEncodeFunction(
      ...masterApeArgs
    );

    // TODO: Update encode to use signature
    // queueTransaction(address target, uint value, string memory signature, bytes memory data, uint eta)
    const timelockQueueEncoded =
      await timelockContract.populateTransaction.queueTransaction(
        MONSTER_CHEF_ADDRESS,
        0,
        "",
        masterApeTXEncoded.data,
        ETA
      );

    // executeTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) public payable returns (bytes memory)
    const timelockExecuteEncoded =
      await timelockContract.populateTransaction.executeTransaction(
        MONSTER_CHEF_ADDRESS,
        0,
        "",
        masterApeTXEncoded.data,
        ETA
      );

    // cancelTransaction(address target, uint value, string memory signature, bytes memory data, uint eta)
    const timelockCancelEncoded =
      await timelockContract.populateTransaction.cancelTransaction(
        MONSTER_CHEF_ADDRESS,
        0,
        "",
        masterApeTXEncoded.data,
        ETA
      );

    const output = {
      "ETA-Timestamp": ETA,
      Date: new Date(ETA * 1000),
      queueTx: "",
      executeTx: "",
      cancelTx: "",
      masterApeTXEncodeFunction: method,
      masterApeArgs,
      masterApeTXEncoded,
      timelockQueueEncoded,
      timelockExecuteEncoded,
      timelockCancelEncoded,
    };

    outputs.push(output);
  }

  console.dir(outputs);
  await writeJSONToFile("./scripts/encode-output.json", outputs);

  //Set delay Time lock Contract -----------------------------
  const TimeLock_Method = "setDelay";
  const TimeLockTXEncodeFunction =
    timelockContract.populateTransaction[TimeLock_Method];
  const TimeLockArgsArray = [21600];
  for (const TimeLockArgs of TimeLockArgsArray) {
    const TimeLockTXEncoded = await TimeLockTXEncodeFunction(...TimeLockArgs);
    
    // queueTransaction(address target, uint value, string memory signature, bytes memory data, uint eta)
    const TLQueueEncoded =
      await timelockContract.populateTransaction.queueTransaction(
        TIMELOCK_ADDRESS,
        0,
        TimeLock_Method,
        TimeLockTXEncoded.data,
        ETA
      );
  }
  //---------------------------------------------------------
};

encode().then(() => {
  console.log("Done encoding!");
});
