// SPDX-License-Identifier: UNLICENSE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract Usdt is ERC20 {
    constructor() ERC20("USDT Stablecoin", "USDT") {}

    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
