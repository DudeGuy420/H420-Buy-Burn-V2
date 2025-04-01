import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { applySlippage, fundWallet, getDeadline, getPackedPath, getQuoteExactInput, getQuoteV2 } from "./utils";
import {
    E280_ADDRESS,
    ELMNT_ADDRESS,
    ELMNT_HOLDER,
    H420_ADDRESS,
    HLX_ADDRESS,
    POOL_FEE_1PERCENT,
    TITANX_ADDRESS,
    WETH9_ADDRESS,
    WL_REGISTRY_ADDRESS,
    WL_REGISTRY_OWNER,
} from "./constants";

export async function deployFixture() {
    //// USERS ////
    const [deployer, owner, user, user2] = await ethers.getSigners();
    const registryOwner = await ethers.getImpersonatedSigner(WL_REGISTRY_OWNER);

    const wlRegistry = await ethers.getContractAt("IWhitelistRegistry", WL_REGISTRY_ADDRESS);
    await wlRegistry.connect(registryOwner).setWhitelisted([user], true);

    //// TOKENS ////
    const h420 = await ethers.getContractAt("IERC20Burnable", H420_ADDRESS);
    const elmnt = await ethers.getContractAt("IERC20", ELMNT_ADDRESS);
    const hlx = await ethers.getContractAt("IERC20", HLX_ADDRESS);
    const e280 = await ethers.getContractAt("IERC20", E280_ADDRESS);
    const weth = await ethers.getContractAt("IWETH9", WETH9_ADDRESS);
    const titanx = await ethers.getContractAt("IERC20", TITANX_ADDRESS);

    const buyBurnF = await ethers.getContractFactory("H420BuyBurnV2");
    const buyBurn = await buyBurnF.deploy(owner);

    return {
        deployer,
        owner,
        user,
        user2,
        h420,
        e280,
        weth,
        titanx,
        hlx,
        elmnt,
        buyBurn,
    };
}

export async function elmntSwapFixtureUniV2Single() {
    const data = await loadFixture(deployFixture);
    const { buyBurn, user, owner, titanx, elmnt } = data;

    const elmntCapPerSwap = 100_000_000n * ethers.WeiPerEther;
    const elmntIncentiveBps = 100;
    const elmntInterval = 300;
    await buyBurn.connect(owner).addUniswapV2Token(elmnt, [elmnt, titanx], elmntCapPerSwap, elmntIncentiveBps, elmntInterval);

    await fundWallet(elmnt, ELMNT_HOLDER, user);
    await elmnt.connect(user).transfer(buyBurn, await elmnt.balanceOf(user));
    const elmntBalance = await elmnt.balanceOf(buyBurn);

    return { ...data, elmntCapPerSwap, elmntIncentiveBps, elmntInterval, elmntBalance };
}

export async function elmntSwapFixtureUniV2Multi() {
    const data = await loadFixture(deployFixture);
    const { buyBurn, user, owner, titanx, weth, elmnt } = data;

    const elmntCapPerSwap = 100_000_000n * ethers.WeiPerEther;
    const elmntIncentiveBps = 100;
    const elmntInterval = 300;
    await buyBurn.connect(owner).addUniswapV2Token(elmnt, [elmnt, titanx, weth], elmntCapPerSwap, elmntIncentiveBps, elmntInterval);

    await fundWallet(elmnt, ELMNT_HOLDER, user);
    await elmnt.connect(user).transfer(buyBurn, await elmnt.balanceOf(user));
    const elmntBalance = await elmnt.balanceOf(buyBurn);

    return { ...data, elmntCapPerSwap, elmntIncentiveBps, elmntInterval, elmntBalance };
}

export async function wethSwapFixtureUniV3() {
    const data = await loadFixture(deployFixture);
    const { buyBurn, user, owner, weth, titanx } = data;
    const wethCapPerSwap = ethers.WeiPerEther;
    const wethIncentiveBps = 100;
    const wethInterval = 300;
    const wethBalance = 3n * ethers.WeiPerEther;
    await buyBurn.connect(owner).addUniswapV3Token(weth, titanx, POOL_FEE_1PERCENT, wethCapPerSwap, wethIncentiveBps, wethInterval);

    await user.sendTransaction({ to: buyBurn, value: wethBalance });

    return { ...data, wethCapPerSwap, wethIncentiveBps, wethInterval, wethBalance };
}

export async function wethSwapFixtureUniV3Multi() {
    const data = await loadFixture(deployFixture);
    const { buyBurn, user, owner, weth, titanx } = data;
    const wethCapPerSwap = ethers.WeiPerEther;
    const wethIncentiveBps = 100;
    const wethInterval = 300;
    const wethBalance = 3n * ethers.WeiPerEther;
    const wethPath = getPackedPath([WETH9_ADDRESS, TITANX_ADDRESS, HLX_ADDRESS], [POOL_FEE_1PERCENT, POOL_FEE_1PERCENT]);

    await buyBurn.connect(owner).addUniswapV3MultihopToken(weth, wethPath, wethCapPerSwap, wethIncentiveBps, wethInterval);

    await user.sendTransaction({ to: buyBurn, value: wethBalance });

    return { ...data, wethCapPerSwap, wethIncentiveBps, wethInterval, wethBalance, wethPath };
}

export async function buyBurnFixtrureE2E() {
    const data = await loadFixture(deployFixture);
    const { buyBurn, user, owner, weth, hlx, e280 } = data;
    const wethCapPerSwap = ethers.WeiPerEther;
    const wethIncentiveBps = 100;
    const wethInterval = 300;
    const wethBalance = 3n * ethers.WeiPerEther;
    const wethPath = getPackedPath([WETH9_ADDRESS, TITANX_ADDRESS, HLX_ADDRESS], [POOL_FEE_1PERCENT, POOL_FEE_1PERCENT]);

    await buyBurn.connect(owner).addUniswapV3MultihopToken(weth, wethPath, wethCapPerSwap, wethIncentiveBps, wethInterval);

    const hlxCapPerSwap = 100_000_000n * ethers.WeiPerEther;
    const hlxIncentiveBps = 100;
    const hlxInterval = 300;

    await buyBurn.connect(owner).addUniswapV2Token(hlx, [HLX_ADDRESS, ELMNT_ADDRESS, E280_ADDRESS], hlxCapPerSwap, hlxIncentiveBps, hlxInterval);

    await user.sendTransaction({ to: buyBurn, value: wethBalance });
    {
        /// swap WETH
        const [callAmount, incentive, ,] = await buyBurn.getSwapParams(WETH9_ADDRESS);
        const swapAmount = callAmount - incentive;
        const amountOut = await getQuoteExactInput(wethPath, swapAmount);
        const minAmount = applySlippage(amountOut);
        await buyBurn.connect(user).swapToken(WETH9_ADDRESS, minAmount, await getDeadline());
    }
    {
        /// swap HLX
        const [callAmount, incentive, ,] = await buyBurn.getSwapParams(HLX_ADDRESS);
        const swapAmount = callAmount - incentive;
        const amountOut = await getQuoteV2([HLX_ADDRESS, ELMNT_ADDRESS, E280_ADDRESS], swapAmount);
        const minAmount = applySlippage(amountOut, 900);
        await buyBurn.connect(user).swapToken(HLX_ADDRESS, minAmount, await getDeadline());
    }
    const e280Balance = await e280.balanceOf(buyBurn);
    const e280CapPerSwap = await buyBurn.capPerSwapBuyBurn();
    const e280IncentiveBps = await buyBurn.buyBurnIncentiveFeeBps();
    const e280Interval = await buyBurn.buyBurnInterval();

    return { ...data, e280CapPerSwap, e280IncentiveBps, e280Interval, e280Balance };
}
