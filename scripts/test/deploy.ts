import { ethers } from "hardhat";
import { fundWallet, getPackedPath, parseUranus, passDays } from "../../config/utils";
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
} from "../../config/constants";

async function main() {
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

    const wethCapPerSwap = ethers.WeiPerEther;
    const wethIncentiveBps = 100;
    const wethInterval = 300;
    const wethBalance = 3n * ethers.WeiPerEther;
    await buyBurn.connect(owner).addUniswapV3Token(weth, titanx, POOL_FEE_1PERCENT, wethCapPerSwap, wethIncentiveBps, wethInterval);
    // const wethPath = getPackedPath([WETH9_ADDRESS, TITANX_ADDRESS, HLX_ADDRESS], [POOL_FEE_1PERCENT, POOL_FEE_1PERCENT]);

    // await buyBurn.connect(owner).addUniswapV3MultihopToken(weth, wethPath, wethCapPerSwap, wethIncentiveBps, wethInterval);

    const hlxCapPerSwap = 100_000_000n * ethers.WeiPerEther;
    const hlxIncentiveBps = 100;
    const hlxInterval = 300;

    await buyBurn.connect(owner).addUniswapV2Token(hlx, [HLX_ADDRESS, ELMNT_ADDRESS, E280_ADDRESS], hlxCapPerSwap, hlxIncentiveBps, hlxInterval);
    await user.sendTransaction({ to: buyBurn, value: wethBalance });

    // adjust time
    const customTimestamp = Math.floor(new Date().getTime() / 1000);

    await ethers.provider.send("evm_setNextBlockTimestamp", [customTimestamp]);

    console.log("H420BuyBurnV2 DEPLOYED TO: ", buyBurn.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
