
pragma solidity 0.6.12;

interface IMonsterReferral {

    function recordReferral(address user, address referrer) external;
    function CalculateCommission(address user, uint256 _amount) external;    
    function harvestCommission(uint256 _amount) external;
    function recordReferralCommission(address referrer, uint256 commission) external;
    function getReferrer(address user) external view returns (address);
    function getPendingComm(address _user) external view returns(uint256);
}