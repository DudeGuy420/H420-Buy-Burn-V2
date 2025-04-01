// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

interface IERC20Burnable is IERC20 {
    function burn(uint256 value) external;
    function totalBurned() external view returns (uint256);
}
