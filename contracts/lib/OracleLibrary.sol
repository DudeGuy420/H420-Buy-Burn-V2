// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// Uniswap
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

// OpenZeppelin
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TickMath} from "./TickMath.sol";

/**
 * @notice Adapted Uniswap V3 OracleLibrary computation to be compliant with Solidity 0.8.x and later.
 *
 * Documentation for Auditors:
 *
 * Solidity Version: Updated the Solidity version pragma to ^0.8.0. This change ensures compatibility
 * with Solidity version 0.8.x.
 *
 * Safe Arithmetic Operations: Solidity 0.8.x automatically checks for arithmetic overflows/underflows.
 * Therefore, the code no longer needs to use SafeMath library (or similar) for basic arithmetic operations.
 * This change simplifies the code and reduces the potential for errors related to manual overflow/underflow checking.
 *
 * Overflow/Underflow: With the introduction of automatic overflow/underflow checks in Solidity 0.8.x, the code is inherently
 * safer and less prone to certain types of arithmetic errors.
 *
 * Removal of SafeMath Library: Since Solidity 0.8.x handles arithmetic operations safely, the use of SafeMath library
 * is omitted in this update.
 *
 * Git-style diff for the `consult` function:
 *
 * ```diff
 * function consult(address pool, uint32 secondsAgo)
 *     internal
 *     view
 *     returns (int24 arithmeticMeanTick, uint128 harmonicMeanLiquidity)
 * {
 *     require(secondsAgo != 0, 'BP');
 *
 *     uint32[] memory secondsAgos = new uint32[](2);
 *     secondsAgos[0] = secondsAgo;
 *     secondsAgos[1] = 0;
 *
 *     (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) =
 *         IUniswapV3Pool(pool).observe(secondsAgos);
 *
 *     int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
 *     uint160 secondsPerLiquidityCumulativesDelta =
 *         secondsPerLiquidityCumulativeX128s[1] - secondsPerLiquidityCumulativeX128s[0];
 *
 * -   arithmeticMeanTick = int24(tickCumulativesDelta / secondsAgo);
 * +   int56 secondsAgoInt56 = int56(uint56(secondsAgo));
 * +   arithmeticMeanTick = int24(tickCumulativesDelta / secondsAgoInt56);
 *     // Always round to negative infinity
 * -   if (tickCumulativesDelta < 0 && (tickCumulativesDelta % secondsAgo != 0)) arithmeticMeanTick--;
 * +   if (tickCumulativesDelta < 0 && (tickCumulativesDelta % secondsAgoInt56 != 0)) arithmeticMeanTick--;
 *
 * -   uint192 secondsAgoX160 = uint192(secondsAgo) * type(uint160).max;
 * +   uint192 secondsAgoUint192 = uint192(secondsAgo);
 * +   uint192 secondsAgoX160 = secondsAgoUint192 * type(uint160).max;
 *     harmonicMeanLiquidity = uint128(secondsAgoX160 / (uint192(secondsPerLiquidityCumulativesDelta) << 32));
 * }
 * ```
 */

/// @title Oracle library
/// @notice Provides functions to integrate with V3 pool oracle
library OracleLibrary {
    /// @notice Calculates time-weighted means of tick and liquidity for a given Uniswap V3 pool
    /// @param pool Address of the pool that we want to observe
    /// @param secondsAgo Number of seconds in the past from which to calculate the time-weighted means
    /// @return arithmeticMeanTick The arithmetic mean tick from (block.timestamp - secondsAgo) to block.timestamp
    /// @return harmonicMeanLiquidity The harmonic mean liquidity from (block.timestamp - secondsAgo) to block.timestamp
    function consult(address pool, uint32 secondsAgo)
        internal
        view
        returns (int24 arithmeticMeanTick, uint128 harmonicMeanLiquidity)
    {
        require(secondsAgo != 0, "BP");

        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) =
            IUniswapV3Pool(pool).observe(secondsAgos);

        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        uint160 secondsPerLiquidityCumulativesDelta =
            secondsPerLiquidityCumulativeX128s[1] - secondsPerLiquidityCumulativeX128s[0];

        // Safe casting of secondsAgo to int56 for division
        int56 secondsAgoInt56 = int56(uint56(secondsAgo));
        arithmeticMeanTick = int24(tickCumulativesDelta / secondsAgoInt56);
        // Always round to negative infinity
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % secondsAgoInt56 != 0)) arithmeticMeanTick--;

        // Safe casting of secondsAgo to uint192 for multiplication
        uint192 secondsAgoUint192 = uint192(secondsAgo);
        harmonicMeanLiquidity = uint128(
            (secondsAgoUint192 * uint192(type(uint160).max)) / (uint192(secondsPerLiquidityCumulativesDelta) << 32)
        );
    }

    /// @notice Given a tick and a token amount, calculates the amount of token received in exchange
    /// @param tick Tick value used to calculate the quote
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    function getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken)
        internal
        pure
        returns (uint256 quoteAmount)
    {
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);

        // Calculate quoteAmount with better precision if it doesn't overflow when multiplied by itself
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            quoteAmount = baseToken < quoteToken
                ? Math.mulDiv(ratioX192, baseAmount, 1 << 192)
                : Math.mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = Math.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
            quoteAmount = baseToken < quoteToken
                ? Math.mulDiv(ratioX128, baseAmount, 1 << 128)
                : Math.mulDiv(1 << 128, baseAmount, ratioX128);
        }
    }

    /// @notice Given a pool, it returns the number of seconds ago of the oldest stored observation
    /// @param pool Address of Uniswap V3 pool that we want to observe
    /// @return secondsAgo The number of seconds ago of the oldest observation stored for the pool
    function getOldestObservationSecondsAgo(address pool) internal view returns (uint32 secondsAgo) {
        (,, uint16 observationIndex, uint16 observationCardinality,,,) = IUniswapV3Pool(pool).slot0();
        require(observationCardinality > 0, "NI");

        (uint32 observationTimestamp,,, bool initialized) =
            IUniswapV3Pool(pool).observations((observationIndex + 1) % observationCardinality);

        // The next index might not be initialized if the cardinality is in the process of increasing
        // In this case the oldest observation is always in index 0
        if (!initialized) {
            (observationTimestamp,,,) = IUniswapV3Pool(pool).observations(0);
        }

        secondsAgo = uint32(block.timestamp) - observationTimestamp;
    }

    /// @notice Given a tick and a token amount, calculates the amount of token received in exchange
    /// a slightly modified version of the UniSwap library getQuoteAtTick to accept a sqrtRatioX96 as input parameter
    /// @param sqrtRatioX96 The sqrt ration
    /// @param baseAmount Amount of token to be converted
    /// @param baseToken Address of an ERC20 token contract used as the baseAmount denomination
    /// @param quoteToken Address of an ERC20 token contract used as the quoteAmount denomination
    /// @return quoteAmount Amount of quoteToken received for baseAmount of baseToken
    function getQuoteForSqrtRatioX96(uint160 sqrtRatioX96, uint256 baseAmount, address baseToken, address quoteToken)
        internal
        pure
        returns (uint256 quoteAmount)
    {
        // Calculate quoteAmount with better precision if it doesn't overflow when multiplied by itself
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            quoteAmount = baseToken < quoteToken
                ? Math.mulDiv(ratioX192, baseAmount, 1 << 192)
                : Math.mulDiv(1 << 192, baseAmount, ratioX192);
        } else {
            uint256 ratioX128 = Math.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
            quoteAmount = baseToken < quoteToken
                ? Math.mulDiv(ratioX128, baseAmount, 1 << 128)
                : Math.mulDiv(1 << 128, baseAmount, ratioX128);
        }
    }
}
