// contracts/GLDToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    uint8 public customDecimals;

    constructor(
        uint8 _decimals,
        uint256 initialSupply
    ) public ERC20("TestERC20", "TEST") {
        _mint(msg.sender, initialSupply);
        customDecimals = _decimals;
        // _setupDecimals(_decimals);
    }

    function decimals() public view override returns (uint8) {
        return customDecimals;
    }
}
