// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./interfaces/IWETH9.sol";
import "./interfaces/IERC20Burnable.sol";
import "./lib/OracleLibrary.sol";
import "./lib/TickMath.sol";
import "./lib/Constants.sol";

/// @title H420 Buy&Burn V2 Contract
contract H420BuyBurnV2 is Ownable2Step {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeERC20 for *;

    enum SwapTypes {
        DISABLED,
        UNI_V2,
        UNI_V3
    }

    struct SwapTokenSettings {
        SwapTypes swapType;
        uint16 incentiveBps;
        uint32 interval;
        uint256 capPerSwap;
    }

    struct SingleSwapOptionsV3 {
        address tokenOut;
        uint24 fee;
    }

    // -------------------------- STATE VARIABLES -------------------------- //

    /// @notice Basis point incentive fee paid out for calling Buy & Burn.
    uint16 public buyBurnIncentiveFeeBps = 30;
    /// @notice Cooldown for Buy & Burns in seconds.
    uint32 public buyBurnInterval = 60 minutes;
    /// @notice Time used for TitanX price calculation.
    uint32 public titanXPriceLookback = 15 minutes;
    /// @notice The maximum amount of DRAGONX that can be swapped per Buy & Burn.
    uint256 public capPerSwapBuyBurn = 140_000_000 ether;
    /// @notice Time of the last Buy & Burn in seconds.
    uint256 public lastBuyBurn;

    /// @notice Currently enabled tokens.
    EnumerableSet.AddressSet private _enabledTokens;
    /// @notice Swap settings per token.
    mapping(address => SwapTokenSettings) public swapSettings;
    /// @notice Times of last swap per token.
    mapping(address => uint256) public swapTimes;
    /// @notice Does token utilize multihop swaps.
    mapping(address => bool) public isMultihopSwap;
    /// @notice Hashed path for a token utilizing Uniswap V3 multihop path.
    mapping(address => bytes) public multihopSwapOptionsV3;
    /// @notice Output token info for Uniswap V3 single swap.
    mapping(address => SingleSwapOptionsV3) public swapOptionsV3;
    /// @notice Path of a swap for Uniswap V2 protocol.
    mapping(address => address[]) public swapOptionsV2;

    // ------------------------------- EVENTS ------------------------------ //

    event SettingsUpdate();
    event TokenSwap();
    event BuyBurn();

    // ------------------------------- ERRORS ------------------------------ //

    error Prohibited();
    error ZeroAddress();
    error ZeroInput();
    error Cooldown();
    error InsufficientBalance();
    error IncorrectPathSettings();
    error TokenNotEnabled();
    error DuplicateSwapToken();
    error Unauthorized();

    // ------------------------------ MODIFIERS ---------------------------- //

    modifier onlyWhitelisted() {
        if (!WL_REGISTRY.isWhitelisted(msg.sender)) revert Unauthorized();
        _;
    }

    // ----------------------------- CONSTRUCTOR --------------------------- //

    constructor(address _owner) Ownable(_owner) {}

    // --------------------------- PUBLIC FUNCTIONS ------------------------ //

    receive() external payable {
        IWETH9(WETH9).deposit{value: msg.value}();
    }

    /// @notice Swaps whitelisted tokens.
    /// @param token Address of a token to swap.
    /// @param minAmountOut Minimum amount of tokens to receive from swap.
    /// @param deadline Deadline timestamp to perform the swap.
    function swapToken(address token, uint256 minAmountOut, uint256 deadline) external onlyWhitelisted {
        (uint256 amount, uint256 incentive, uint256 nextAvailable, SwapTypes swapType) = getSwapParams(token);
        if (block.timestamp < nextAvailable) revert Cooldown();
        if (amount == 0) revert InsufficientBalance();

        swapTimes[token] = block.timestamp;
        if (swapType == SwapTypes.UNI_V2) {
            _handleV2Swap(token, amount - incentive, minAmountOut, deadline);
        } else if (swapType == SwapTypes.UNI_V3) {
            _handleV3Swap(token, amount - incentive, minAmountOut, deadline);
        } else revert Prohibited();

        IERC20(token).safeTransfer(msg.sender, incentive);
        emit TokenSwap();
    }

    /// @notice Buys and burns H420 tokens using E280 balance.
    /// @param minAmountOut The minimum amount out for E280 -> H420 swap.
    /// @param deadline The deadline for the swaps.
    function buyAndBurn(uint256 minAmountOut, uint256 deadline) external onlyWhitelisted {
        (uint256 amount, uint256 incentive, uint256 nextAvailable) = getBuyBurnParams();
        if (block.timestamp < nextAvailable) revert Cooldown();
        if (amount == 0) revert InsufficientBalance();
        
        lastBuyBurn = block.timestamp;
        _swapE280ToH420(amount - incentive, minAmountOut, deadline);
        burnH420Tokens();

        IERC20(E280).safeTransfer(msg.sender, incentive);
        emit BuyBurn();
    }

    /// @notice Burns all H420 tokens available in the contract.
    function burnH420Tokens() public {
        IERC20Burnable h420 = IERC20Burnable(H420);
        uint256 totalBalance = h420.balanceOf(address(this));
        if (totalBalance == 0) revert InsufficientBalance();
        h420.burn(totalBalance);
    }

    // ----------------------- ADMINISTRATIVE FUNCTIONS -------------------- //

    /// @notice Sets the incentive fee basis points (bps) for Buy & Burn calls.
    /// @param bps The incentive fee in basis points (30 - 500), (100 bps = 1%).
    function setBuyBurnIncentiveFee(uint16 bps) external onlyOwner {
        if (bps < 30 || bps > 500) revert Prohibited();
        buyBurnIncentiveFeeBps = bps;
        emit SettingsUpdate();
    }

    /// @notice Sets the Buy & Burn interval.
    /// @param limit The new interval in seconds.
    function setBuyBurnInterval(uint32 limit) external onlyOwner {
        if (limit == 0) revert Prohibited();
        buyBurnInterval = limit;
        emit SettingsUpdate();
    }

    /// @notice Sets the cap per swap for DRAGONX -> BDX swaps during Buy&Burn calls.
    /// @param limit The new cap limit in WEI applied to DRAGONX balance.
    function setCapPerSwapBuyBurn(uint256 limit) external onlyOwner {
        capPerSwapBuyBurn = limit;
        emit SettingsUpdate();
    }

    /// @notice Sets the number of seconds to look back for TitanX price calculations.
    /// @param time The number of seconds to use for price lookback.
    function setTitanXPriceLookback(uint32 time) external onlyOwner {
        if (time == 0) revert ZeroInput();
        titanXPriceLookback = time;
    }

    /// @notice Adds a swap token that requires a Uniswap V2 swap.
    /// @param token Address of the token to be enabled.
    /// @param path Array of addresses from input token to output token. (Supports Multihop)
    /// @param capPerSwap Maximum amount of tokens to be swapped in a single call.
    /// @param incentiveBps Basis points to be paid out as incentive to the caller (1% = 100 bps).
    /// @param interval Cooldown time in seconds.
    function addUniswapV2Token(address token, address[] memory path, uint256 capPerSwap, uint16 incentiveBps, uint32 interval) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (path.length < 2 || path[0] != token) revert IncorrectPathSettings();
        if (!_enabledTokens.add(token)) revert DuplicateSwapToken();
        swapOptionsV2[token] = path;
        swapSettings[token] = SwapTokenSettings(SwapTypes.UNI_V2, incentiveBps, interval, capPerSwap);
        emit SettingsUpdate();
    }

    /// @notice Adds a swap token that requires a Uniswap V3 Single swap.
    /// @param token Address of the token to be enabled.
    /// @param tokenOut Address of the output token.
    /// @param poolFee Fee of the V3 pool between input and output tokens.
    /// @param capPerSwap Maximum amount of tokens to be distributed in a single call.
    /// @param incentiveBps Basis points to be paid out as incentive to the caller (1% = 100 bps).
    /// @param interval Cooldown time in seconds.
    function addUniswapV3Token(address token, address tokenOut, uint24 poolFee, uint256 capPerSwap, uint16 incentiveBps, uint32 interval) external onlyOwner {
        if (token == address(0) || tokenOut == address(0)) revert ZeroAddress();
        if (!_enabledTokens.add(token)) revert DuplicateSwapToken();
        swapSettings[token] = SwapTokenSettings(SwapTypes.UNI_V3, incentiveBps, interval, capPerSwap);
        swapOptionsV3[token] = SingleSwapOptionsV3(tokenOut, poolFee);
        isMultihopSwap[token] = false;
        emit SettingsUpdate();
    }

    /// @notice Adds a swap token that requires a Uniswap V3 Multihop swap.
    /// @param token Address of the token to be enabled.
    /// @param path Hashed path for the swap.
    /// @param capPerSwap Maximum amount of tokens to be distributed in a single call.
    /// @param incentiveBps Basis points to be paid out as incentive to the caller (1% = 100 bps).
    /// @param interval Cooldown time in seconds.
    function addUniswapV3MultihopToken(address token, bytes memory path, uint256 capPerSwap, uint16 incentiveBps, uint32 interval) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (!_enabledTokens.add(token)) revert DuplicateSwapToken();
        swapSettings[token] = SwapTokenSettings(SwapTypes.UNI_V3, incentiveBps, interval, capPerSwap);
        multihopSwapOptionsV3[token] = path;
        isMultihopSwap[token] = true;
        emit SettingsUpdate();
    }

    /// @notice Removes a swap token from whitelisted tokens.
    /// @param token Address of the token to edit.
    /// @param capPerSwap Maximum amount of tokens to be distributed in a single call.
    /// @param incentiveBps Basis points to be paid out as incentive to the caller (1% = 100 bps).
    /// @param interval Cooldown time in seconds.
    function editTokenSettings(address token, uint256 capPerSwap, uint16 incentiveBps, uint32 interval) external onlyOwner {
        if (!_enabledTokens.contains(token)) revert TokenNotEnabled();
        SwapTokenSettings storage settings = swapSettings[token];
        settings.capPerSwap = capPerSwap;
        settings.incentiveBps = incentiveBps;
        settings.interval = interval;
        emit SettingsUpdate();
    }

    /// @notice Removes a swap token from whitelisted tokens.
    /// @param token Address of the token to be disabled.
    function disableToken(address token) external onlyOwner {
        if (!_enabledTokens.remove(token)) revert TokenNotEnabled();
        delete swapSettings[token];
        delete swapOptionsV2[token];
        delete swapOptionsV3[token];
        delete multihopSwapOptionsV3[token];
        delete isMultihopSwap[token];
        emit SettingsUpdate();
    }

    // ---------------------------- VIEW FUNCTIONS ------------------------- //

    /// @notice Returns parameters for the next token swap.
    /// @param token Address of the token to be used in a swap.
    /// @return amount Total token amount used in the next swap.
    /// @return incentive Token amount paid out as incentive to the caller.
    /// @return nextAvailable Timestamp in seconds when next swap will be available.
    /// @return swapType Type of the swap to be performed.
    function getSwapParams(address token) public view returns (uint256 amount, uint256 incentive, uint256 nextAvailable, SwapTypes swapType) {
        SwapTokenSettings memory settings = swapSettings[token];
        if (settings.swapType == SwapTypes.DISABLED) revert TokenNotEnabled();
        uint256 balance = IERC20(token).balanceOf(address(this));
        amount = balance > settings.capPerSwap ? settings.capPerSwap : balance;
        nextAvailable = swapTimes[token] + settings.interval;
        incentive = _applyBps(amount, settings.incentiveBps);
        swapType = settings.swapType;
    }

    /// @notice Returns parameters for the next Buy & Burn.
    /// @return amount Total E280 amount used in the next Buy & Burn.
    /// @return incentive E280 amount paid out as incentive to the caller.
    /// @return nextAvailable Timestamp in seconds when next Buy & Burn will be available.
    function getBuyBurnParams() public view returns (uint256 amount, uint256 incentive, uint256 nextAvailable) {
        uint256 balance = IERC20(E280).balanceOf(address(this));
        amount = balance > capPerSwapBuyBurn ? capPerSwapBuyBurn : balance;
        nextAvailable = lastBuyBurn + buyBurnInterval;
        incentive = _applyBps(amount, buyBurnIncentiveFeeBps);
    }

    /// @notice Returns a list of all enabled swap tokens.
    function getEnabledTokens() external view returns (address[] memory) {
        return _enabledTokens.values();
    }

    /// @notice Returns a full Uniswap path for a V2 swap token.
    function getUniswapV2Path(address token) external view returns (address[] memory) {
        return swapOptionsV2[token];
    }

    /// @notice Returns current TitanX price in HLX/TITANX pool.
    function getCurrentTitanPrice() public view returns (uint256) {
        uint32 _secondsAgo = titanXPriceLookback;
        uint32 oldestObservation = OracleLibrary.getOldestObservationSecondsAgo(TITANX_HLX_POOL);
        if (oldestObservation < _secondsAgo) _secondsAgo = oldestObservation;

        (int24 arithmeticMeanTick,) = OracleLibrary.consult(TITANX_HLX_POOL, _secondsAgo);
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(arithmeticMeanTick);
        return OracleLibrary.getQuoteForSqrtRatioX96(sqrtPriceX96, 1 ether, HLX, TITANX);
    }

    // -------------------------- INTERNAL FUNCTIONS ----------------------- //

    function _applyBps(uint256 amount, uint16 incentiveBps) internal pure returns (uint256) {
        return (amount * incentiveBps) / BPS_BASE;
    }

    function _swapE280ToH420(uint256 amountIn, uint256 minAmountOut, uint256 deadline) internal {
        IERC20(E280).safeIncreaseAllowance(UNISWAP_V2_ROUTER, amountIn);
        address[] memory path = new address[](2);
        path[0] = E280;
        path[1] = H420;
        IUniswapV2Router02(UNISWAP_V2_ROUTER).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn, minAmountOut, path, address(this), deadline
        );
    }

    function _handleV2Swap(address token, uint256 amountIn, uint256 minAmountOut, uint256 deadline) internal {
        IERC20(token).safeIncreaseAllowance(UNISWAP_V2_ROUTER, amountIn);
        address[] memory path = swapOptionsV2[token];
        IUniswapV2Router02(UNISWAP_V2_ROUTER).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn, minAmountOut, path, address(this), deadline
        );
    }

    function _handleV3Swap(address token, uint256 amountIn, uint256 minAmountOut, uint256 deadline) internal {
        IERC20(token).safeIncreaseAllowance(UNISWAP_V3_ROUTER, amountIn);
        if (isMultihopSwap[token]) {
            ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
                path: multihopSwapOptionsV3[token],
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut
            });
            ISwapRouter(UNISWAP_V3_ROUTER).exactInput(params);
        } else {
            SingleSwapOptionsV3 memory options = swapOptionsV3[token];
            ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
                tokenIn: token,
                tokenOut: options.tokenOut,
                fee: options.fee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });
            ISwapRouter(UNISWAP_V3_ROUTER).exactInputSingle(params);
        }
    }
}
