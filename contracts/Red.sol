// SPDX-License-Identifier: UNLICENSE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract Red is ERC20 {
    constructor() ERC20("Red token", "RED") {}

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
