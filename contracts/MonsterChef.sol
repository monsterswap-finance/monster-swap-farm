// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/*
 * MonsterSwap 
 * App:             https://monsterswap.finance
 * Medium:          https://monsterswap.medium.com/    
 * Twitter:         https://twitter.com/MonsterSwapping
 * Telegram:        https://t.me/monster_finance
 * Announcements:   https://t.me/monsterswap_news
 * GitHub:          https://github.com/monsterswap-finance
 */


import '@pancakeswap/pancake-swap-lib/contracts/math/SafeMath.sol';
import '@pancakeswap/pancake-swap-lib/contracts/token/BEP20/IBEP20.sol';
import '@pancakeswap/pancake-swap-lib/contracts/token/BEP20/SafeBEP20.sol';
import '@pancakeswap/pancake-swap-lib/contracts/access/Ownable.sol';

import "./MonsterToken.sol";
import "./MonsterDai.sol";
import "./interface/IMonsterReferral.sol";

// MonsterChef is the master of Monster. 
// He can make Kaiju and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once BANANA is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract MonsterChef is Ownable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of KAIJUs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accCakePerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accCakePerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IBEP20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. KAIJUs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that KAIJUs distribution occurs.
        uint256 accCakePerShare; // Accumulated KAIJUs per share, times 1e12. See below.
        uint16 depositFeeBP;      // Deposit fee in basis points
        uint16 harvestFeeBP;  // Harvest fee in basis points
    }

    // The KAIJU TOKEN!
    MonsterToken public cake;    
    // Deposit Fee address
    address public feeAddress;
    // The MONSTERDAI TOKEN!
    MonsterDai public syrup;
    // Dev address.
    address public devaddr;
    // KAIJU tokens created per block.
    uint256 public cakePerBlock;
    // Bonus muliplier for early kaiju makers.
    uint256 public BONUS_MULTIPLIER;
    
    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when KAIJU mining starts.
    uint256 public startBlock;

    // Monster referral contract address.
    IMonsterReferral public monsterReferral;

    // Max Bonus Multiplier : 4
    uint16 public constant MAXIMUM_BONUS_MULTIPLIER = 4;
    // Max deposit fee: 4%.
    uint16 public constant MAXIMUM_DEPOSIT_FEE = 400;
    // Max harvest fee: 4%.
    uint16 public constant MAXIMUM_HARVEST_FEE = 400;



    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event ReferralCommissionPaid(address indexed user, address indexed referrer, uint256 commissionAmount);
    event SetReferralAddress(address indexed user, IReferral indexed newAddress);
    event SetDevAddress(address indexed _devaddr);
    event SetFeeAddress(address indexed _feeAddress);
    event SetMultiplier(uint256 indexed _multiplier);
    event AddPool(IBEP20 indexed _lpToken, uint256 _allocPoint, uint256 _depositFeeBP, uint256 _harvestFeeBP);
    event UpdatePool(uint256 indexed pid, uint256 _allocPoint, uint256 _depositFeeBP, uint256 _harvestFeeBP);

    constructor(
        MonsterToken _monster,
        MonsterDai _monsterDai,
        address _devaddr,
        address _feeaddr,
        uint256 _monsterPerBlock,
        uint256 _startBlock,
        uint256 _multiplier
    ) public {
        cake = _monster;
        syrup = _monsterDai;
        devaddr = _devaddr;
        feeAddress = _feeaddr;    
        cakePerBlock = _monsterPerBlock;
        startBlock = _startBlock;
        BONUS_MULTIPLIER = _multiplier;
            
        // staking pool
        poolInfo.push(PoolInfo({
            lpToken: _monster,
            allocPoint: 1000,
            lastRewardBlock: startBlock,
            accCakePerShare: 0,
            depositFeeBP: 0,
            harvestFeeBP: 0
        }));

        totalAllocPoint = 1000;

    }

    modifier validatePool(uint256 _pid) {
        require(_pid < poolInfo.length, "validatePool: pool exists?");
        _;
    }

    function updateMultiplier(uint256 multiplierNumber) public onlyOwner {
        require(multiplierNumber <= MAXIMUM_BONUS_MULTIPLIER, "setMultiplier: invalid multiplier number");
        BONUS_MULTIPLIER = multiplierNumber;
        emit SetMultiplier(multiplierNumber);    
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Detects whether the given pool already exists
    function checkPoolDuplicate(IBEP20 _lpToken) public view {
        uint256 length = poolInfo.length;
        for (uint256 _pid = 0; _pid < length; _pid++) {
            require(poolInfo[_pid].lpToken != _lpToken, "add: existing pool");
        }
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, IBEP20 _lpToken,  uint16 _depositFeeBP, uint16 _harvestFeeBP, bool _withUpdate) public onlyOwner {
        require(_depositFeeBP <= MAXIMUM_DEPOSIT_FEE, "set: invalid deposit fee basis points");
        require(_harvestFeeBP <= MAXIMUM_HARVEST_FEE, "set: invalid harvest fee basis points");

        if (_withUpdate) {
            massUpdatePools();
        }
        checkPoolDuplicate(_lpToken);
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accCakePerShare: 0,
            depositFeeBP: _depositFeeBP,
            harvestFeeBP: _harvestFeeBP
        }));
        updateStakingPool();

        emit AddPool(_lpToken, _allocPoint, _depositFeeBP, _harvestFeeBP);
    }

    // Update the given pool's KAIJU allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, uint16 _depositFeeBP, uint16 _harvestFeeBP, bool _withUpdate) public onlyOwner {
        require(_depositFeeBP <= MAXIMUM_DEPOSIT_FEE, "set: invalid deposit fee basis points");
        require(_harvestFeeBP <= MAXIMUM_HARVEST_FEE, "set: invalid harvest fee basis points");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        poolInfo[_pid].depositFeeBP = _depositFeeBP;
        poolInfo[_pid].harvestFeeBP = _harvestFeeBP;

        if (prevAllocPoint != _allocPoint) {
            totalAllocPoint = totalAllocPoint.sub(prevAllocPoint).add(_allocPoint);
            updateStakingPool();
        }

        emit UpdatePool(_pid, _allocPoint, _depositFeeBP, _harvestFeeBP);
    }

    function updateStakingPool() internal {
        uint256 length = poolInfo.length;
        uint256 points = 0;
        for (uint256 pid = 1; pid < length; ++pid) {
            points = points.add(poolInfo[pid].allocPoint);
        }
        if (points != 0) {
            points = points.div(3);
            totalAllocPoint = totalAllocPoint.sub(poolInfo[0].allocPoint).add(points);
            poolInfo[0].allocPoint = points;
        }
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        return _to.sub(_from).mul(BONUS_MULTIPLIER);
    }

    // View function to see pending MONSTERs on frontend.
    function pendingCake(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accCakePerShare = pool.accCakePerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 cakeReward = multiplier.mul(cakePerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accCakePerShare = accCakePerShare.add(cakeReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accCakePerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }


    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public validatePool(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0 || pool.allocPoint == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 cakeReward = multiplier.mul(cakePerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        cake.mint(devaddr, cakeReward.div(10));
        cake.mint(address(syrup), cakeReward);


        pool.accCakePerShare = pool.accCakePerShare.add(cakeReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MonsterChef for MONSTER allocation.
    function deposit(uint256 _pid, uint256 _amount, address _referrer) public validatePool(_pid) {

        require (_pid != 0, 'deposit MONSTER by staking');

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (_amount > 0 && address(monsterReferral) != address(0) && _referrer != address(0) && _referrer != msg.sender) {
            monsterReferral.recordReferral(msg.sender, _referrer);
        }

        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accCakePerShare).div(1e12).sub(user.rewardDebt);
            if(pending > 0) {
                if (pool.harvestFeeBP > 0) {
                    uint256 harvestFee = pending.mul(pool.harvestFeeBP).div(10000);
                    pool.lpToken.safeTransfer(feeAddress, harvestFee);
                    pending = pending.sub(harvestFee);
                }
                safeCakeTransfer(msg.sender, pending);    
                payReferralCommission(msg.sender, pending);    
            }
        }
        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
             if (pool.depositFeeBP > 0) {
                uint256 depositFee = _amount.mul(pool.depositFeeBP).div(10000);
                if (depositFee > 0) {
                    pool.lpToken.safeTransfer(feeAddress, depositFee);
                }                
                user.amount = user.amount.add(_amount).sub(depositFee);
            } else {
                user.amount = user.amount.add(_amount);
            }           
        }
        user.rewardDebt = user.amount.mul(pool.accCakePerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MonsterChef.
    function withdraw(uint256 _pid, uint256 _amount) public validatePool(_pid) {
        require (_pid != 0, 'withdraw MONSTER by unstaking');
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);
        uint256 pending = user.amount.mul(pool.accCakePerShare).div(1e12).sub(user.rewardDebt);
        if(pending > 0) {            
            if (pool.harvestFeeBP > 0) {
                uint256 harvestFee = pending.mul(pool.harvestFeeBP).div(10000);
                pool.lpToken.safeTransfer(feeAddress, harvestFee);
                pending = pending.sub(harvestFee);
            }
            safeCakeTransfer(msg.sender, pending);
            payReferralCommission(msg.sender, pending);
        }
        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);

            
        }
        user.rewardDebt = user.amount.mul(pool.accCakePerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Stake MONSTER tokens to MonsterChef
    function enterStaking(uint256 _amount) public {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];
        updatePool(0);
       
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accCakePerShare).div(1e12).sub(user.rewardDebt);
            if(pending > 0) {
                if (pool.harvestFeeBP > 0) {
                    uint256 harvestFee = pending.mul(pool.harvestFeeBP).div(10000);
                    pool.lpToken.safeTransfer(feeAddress, harvestFee);
                    pending = pending.sub(harvestFee);
                }
                safeCakeTransfer(msg.sender, pending);    
                payReferralCommission(msg.sender, pending);    
            }
        }


        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
             if (pool.depositFeeBP > 0) {
                uint256 depositFee = _amount.mul(pool.depositFeeBP).div(10000);
                if (depositFee > 0) {
                    pool.lpToken.safeTransfer(feeAddress, depositFee);
                }                
                user.amount = user.amount.add(_amount).sub(depositFee);
            } else {
                user.amount = user.amount.add(_amount);
            }           
        }       
        user.rewardDebt = user.amount.mul(pool.accCakePerShare).div(1e12);

        syrup.mint(msg.sender, _amount);
        emit Deposit(msg.sender, 0, _amount);
    }

    // Withdraw MONSTER tokens from STAKING.
    function leaveStaking(uint256 _amount) public {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(0);
        uint256 pending = user.amount.mul(pool.accCakePerShare).div(1e12).sub(user.rewardDebt);        
        if(pending > 0) {            
            if (pool.harvestFeeBP > 0) {
                uint256 harvestFee = pending.mul(pool.harvestFeeBP).div(10000);
                pool.lpToken.safeTransfer(feeAddress, harvestFee);
                pending = pending.sub(harvestFee);
            }
            safeCakeTransfer(msg.sender, pending);
            payReferralCommission(msg.sender, pending);
        }
        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accCakePerShare).div(1e12);

        syrup.burn(msg.sender, _amount);
        emit Withdraw(msg.sender, 0, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        user.amount = 0;
        user.rewardDebt = 0;
        if(_pid == 0) {
            syrup.burn(msg.sender, user.amount);
        }
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);       
    }

    // Pay referral commission to the referrer who referred this user.
    function payReferralCommission(address _user, uint256 commissionAmount) internal {
        if (address(monsterReferral) != address(0) && referralCommissionRate > 0) {
            address referrer = monsterReferral.getReferrer(_user);
          
            if (referrer != address(0) && commissionAmount > 0) {
                 monsterReferral.CalculateCommission(msg.sender, commissionAmount);
            }
        }
    }

    function getPoolInfo(uint256 _pid) public view
    returns(address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accCakePerShare) {
        return (address(poolInfo[_pid].lpToken),
            poolInfo[_pid].allocPoint,
            poolInfo[_pid].lastRewardBlock,
            poolInfo[_pid].accCakePerShare);
    }

    // Safe cake transfer function, just in case if rounding error causes pool to not have enough KAIJUs.
    function safeCakeTransfer(address _to, uint256 _amount) internal {
        syrup.safeCakeTransfer(_to, _amount);
    }

    // Update dev address by the previous dev.
    function setDevAddress(address _devaddr) public {
        require(msg.sender == devaddr, "setDevAddress: FORBIDDEN?");
        require(_devaddr != address(0), "setDevAddress: ZERO");

         devaddr = _devaddr;
         emit SetDevAddress(msg.sender, _devaddr);
    }

    // Update Fee Address By Previous feeAddr
     function setFeeAddress(address _feeAddress) public {
        require(msg.sender == feeAddress, "setFeeAddress: FORBIDDEN");
        require(_feeAddress != address(0), "setFeeAddress: ZERO");
        
        feeAddress = _feeAddress;
        emit SetFeeAddress(msg.sender, _feeAddress);
    }

    // Update the monster referral contract address by the owner
    function setMonsterReferral(IMonsterReferral _monsterReferral) public onlyOwner {
        monsterReferral = _monsterReferral;
        emit SetReferralAddress(msg.sender, _monsterReferral);
    }
}
