// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IPearlFactory {
    function getPair(
        address tokenA,
        address tokenB,
        bool stable
    ) external returns (address pair);

    function getReserves(
        address tokenA,
        address tokenB
    ) external view returns (uint256 reserveA, uint256 reserveB);
}
