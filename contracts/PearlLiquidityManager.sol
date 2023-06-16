// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IPearlRouter} from "./interfaces/IPearlRouter.sol";
import {IPearlFactory} from "./interfaces/IPearlFactory.sol";
import {IPearlPair} from "./interfaces/IPearlPair.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PearlLiquidityManager
/// @author Untitled Labs (https://untitledlabs.io)
/// @notice It takes single side deposits from DAI and splits the liquidity to Pearl's DAI/USDR and USDR/USDC pools based on Split Ratio

contract PearlLiquidityManager is Ownable {
    address public dai;
    address public usdr;
    address public usdc;
    IPearlRouter public pearlRouter;
    uint256 public splitRatio; // first portion is for DAI/USDR pool, second portion is for USDR/USDC pool
    uint256 public constant BASE = 10000;

    error InvalidSplitRatio();

    /// @notice Sets the DAI, USDR, and USDC tokens, the split ratio, and the Pearl Router
    /// @param _dai The DAI token address
    /// @param _usdr The USDR token address
    /// @param _usdc The USDC token address
    /// @param _splitRatio The split ratio for the DAI/USDR and USDR/USDC pools
    /// @param _pearlRouter The Pearl Router address
    constructor(
        address _dai,
        address _usdr,
        address _usdc,
        uint256 _splitRatio,
        IPearlRouter _pearlRouter
    ) {
        if (_splitRatio > BASE) {
            revert InvalidSplitRatio();
        }
        dai = _dai;
        usdr = _usdr;
        usdc = _usdc;
        pearlRouter = _pearlRouter;
        splitRatio = _splitRatio;
    }

    /// @notice Takes the single side liquidity in DAI and adds it to the DAI/USDR and USDR/USDC pools based on the split percentage
    /// @param amount The amount of DAI to add to the pools
    function addLiquidity(uint256 amount) external {
        // transfer USDR from user to this contract
        IERC20(dai).transferFrom(msg.sender, address(this), amount);

        // add balance to the total amount to redeploy unused liquidity
        amount = IERC20(dai).balanceOf(address(this));

        // split the liquidity
        uint256 daiPoolLiquidity = (amount * splitRatio) / 10000;
        uint256 usdcPoolLiquidity = amount - daiPoolLiquidity;

        // add to DAI/USDR pool
        _addLiquidityDaiPool(daiPoolLiquidity);

        // add to USDR/USDC pool
        _addLiquidityUsdcPool(usdcPoolLiquidity);

        // settle balances in DAI to be reused later.
        _settle();
    }

    /// @notice Adds liquidity to the DAI/USDR pool
    /// @notice It swaps DAI for USDR and then adds liquidity to the pool
    /// @param amount The amount of DAI to add to the pool
    function _addLiquidityDaiPool(uint256 amount) internal {
        // swap from DAI to USDR
        (uint256 daiAmount, uint256 usdrAmount) = _swap(dai, usdr, amount / 2);

        // add liquidity to the DAI/USDR pool
        _addLiquidity(dai, usdr, daiAmount, usdrAmount);
    }

    /// @notice Settles balances in DAI to be reused later
    /// @notice It swaps USDC to DAI and USDR to DAI
    function _settle() internal {
        uint256 usdcAmount = IERC20(usdc).balanceOf(address(this));
        uint256 usdrAmount = IERC20(usdr).balanceOf(address(this));

        // convert USDC to DAI
        _swap(usdc, dai, usdcAmount);

        // convert USDR to DAI
        _swap(usdr, dai, usdrAmount);
    }

    /// @notice Adds liquidity to the USDR/USDC pool
    /// @notice It swaps DAI for USDR, then swaps DAI for USDC, and then adds liquidity to the pool
    /// @param amount The amount of DAI to add to the pool
    function _addLiquidityUsdcPool(uint256 amount) internal {
        uint256 usdrAmount;
        uint256 usdcAmount;

        // swap DAI to USDR
        (, usdrAmount) = _swap(dai, usdr, amount / 2);

        // swap DAI to USDC
        (, usdcAmount) = _swap(dai, usdc, amount / 2);

        // add liquidity to the USDC/USDR pool
        _addLiquidity(usdr, usdc, usdrAmount, usdcAmount);
    }

    /// @notice Adds liquidity to the pool
    /// @param tokenA The first token in the pair
    /// @param tokenB The second token in the pair
    /// @param tokenAAmount The amount of the first token to add to the pool
    /// @param tokenBAmount The amount of the second token to add to the pool
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 tokenAAmount,
        uint256 tokenBAmount
    ) internal returns (uint256 amountA, uint256 amountB) {
        // Approve tokens to be spent by the router
        IERC20(tokenA).approve(address(pearlRouter), tokenAAmount);
        IERC20(tokenB).approve(address(pearlRouter), tokenBAmount);

        // add liquidity to the pool
        (amountA, amountB, ) = pearlRouter.addLiquidity(
            tokenA,
            tokenB,
            true,
            tokenAAmount,
            tokenBAmount,
            0,
            0,
            address(this),
            block.timestamp + 1
        );
    }

    /// @notice Swaps tokens
    /// @param tokenIn The token to swap from
    /// @param tokenOut The token to swap to
    /// @param amountIn The amount of the token to swap from
    function _swap(
        address tokenIn,
        address tokenOut,
        uint256 amount
    ) internal returns (uint256 amountIn, uint256 amountOut) {
        // Approve tokens to be spent by the router
        IERC20(tokenIn).approve(address(pearlRouter), amount);

        // swap tokens
        uint256[] memory amounts = pearlRouter.swapExactTokensForTokensSimple(
            amount,
            0, // slippage set to 2%
            tokenIn,
            tokenOut,
            true,
            address(this),
            block.timestamp + 1
        );

        amountIn = amounts[0];
        amountOut = amounts[1];
    }

    /// @notice Sweeps token from contract to the caller.
    /// @param token The token to sweep
    function sweep(address token) external onlyOwner {
        IERC20(token).transfer(
            msg.sender,
            IERC20(token).balanceOf(address(this))
        );
    }

    /// @notice Changes the split ratio
    /// @param _splitRatio The new split ratio
    function changeSplitRatio(uint256 _splitRatio) external onlyOwner {
        if (_splitRatio > BASE) {
            revert InvalidSplitRatio();
        }
        splitRatio = _splitRatio;
    }
}
