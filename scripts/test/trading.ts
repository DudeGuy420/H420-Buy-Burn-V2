import { ethers } from "hardhat";
import {
    AWESOMEX_ADDRESS,
    BDX_ADDRESS,
    BDX_BUY_BURN_ADDRESS,
    DRAGONX_ADDRESS,
    E280_ADDRESS,
    HYDRA_ADDRESS,
    PERCENTAGE_LIST,
    TITANX_ADDRESS,
    TOKEN_LIST,
} from "../../test/constants";
import {
    applySlippage,
    calculateClaimPenalty,
    calculatePercentage,
    getAmountOut,
    getAmountOutPresale,
    getAmountOutV3,
    getDeadline,
    parseScale,
    passDays,
} from "../../test/utils";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
export const mmOwner = "0x44c4ADAc7d88f85d3D33A7f856Ebc54E60C31E97";

export const mekleRoot = "0x1674540bd40f9fb9a6fb8a2be058ca922ca7b706ed46343c403b9086dcd3e11b";

async function main() {
    const [owner, hh2, hh3, wl5, wl75] = await ethers.getSigners();
    /// Tokens
    const titanX = await ethers.getContractAt("ITITANX", TITANX_ADDRESS);
    const dragonX = await ethers.getContractAt("IERC20", DRAGONX_ADDRESS);
    const bdx = await ethers.getContractAt("IERC20", BDX_ADDRESS);
    const hydra = await ethers.getContractAt("IHydra", HYDRA_ADDRESS);
    const awesomex = await ethers.getContractAt("IERC20", AWESOMEX_ADDRESS);
    const e280 = await ethers.getContractAt("IERC20", E280_ADDRESS);

    const tokenFactory = await ethers.getContractFactory("SCALE");
    const uranus = await tokenFactory.deploy(owner, mmOwner, mmOwner, mmOwner, DRAGONX_ADDRESS, BDX_BUY_BURN_ADDRESS, TOKEN_LIST, PERCENTAGE_LIST);
    const shedFactory = await ethers.getContractFactory("SHED");
    const shed = await shedFactory.deploy(owner, BDX_BUY_BURN_ADDRESS, mmOwner);

    const _activeInstance = await shed.activeInstance();
    const activeInstance = await ethers.getContractAt("SHEDMiner", _activeInstance);
    const tokenContracts = [bdx, dragonX, hydra, awesomex, e280];

    const user505b = await ethers.getImpersonatedSigner("0xA3E972D8ED2D5B978Abb0092479aF8601ddA18B0");
    const user304b = await ethers.getImpersonatedSigner("0xd1DFb5693AEa8FCb6Abf4B760aACD909B816fF65");
    const user1b = await ethers.getImpersonatedSigner("0xd0F9d46a4E0c40F2E08bB2411FdB5676F7495eFa");
    await owner.sendTransaction({ value: ethers.parseEther("1"), to: user505b });
    await owner.sendTransaction({ value: ethers.parseEther("1"), to: user304b });
    await owner.sendTransaction({ value: ethers.parseEther("1"), to: user1b });
    const user304Balance = await titanX.balanceOf(user304b);
    const user505Balance = await titanX.balanceOf(user505b);
    const user1BBalance = await titanX.balanceOf(user505b);
    const shareWL = user304Balance / 2n;
    const share = user505Balance / 2n;
    await titanX.connect(user1b).transfer(shed, user1BBalance);
    await titanX.connect(user505b).transfer(hh2, share);
    await titanX.connect(user505b).transfer(hh3, share);
    await titanX.connect(user304b).transfer(wl5, shareWL);
    await titanX.connect(user304b).transfer(wl75, shareWL);

    await uranus.connect(owner).setMerkleRoot(mekleRoot);
    await uranus.connect(owner).setSHED(shed.target);
    await uranus.connect(owner).startPresale();

    const userUranusBalance = parseScale(50000000);
    const user2UranusBalance = parseScale(100000000);
    const wl75ScaleBalance = parseScale(100000000);

    await titanX.connect(hh2).approve(uranus.target, userUranusBalance * 10n ** 9n);
    await titanX.connect(hh3).approve(uranus.target, user2UranusBalance * 10n ** 9n);
    await titanX.connect(wl75).approve(uranus.target, shareWL);
    await uranus.connect(hh2).mintWithTitanX(userUranusBalance, 0, []);
    await uranus.connect(hh3).mintWithTitanX(user2UranusBalance, 0, []);
    await uranus
        .connect(wl75)
        .mintWithTitanX(wl75ScaleBalance, 750, [
            "0x789fc68e416841acdc112cd99862f6d398208d46010eecdd81b88cd39236dba1",
            "0xfdf2580a39df909752f3155f213fc0f7edf9e0a43cec24331a78668ff9ed961b",
        ]);

    await passDays(15);

    await uranus.connect(owner).finalizePresale();
    const titanLpPool = await uranus.titanLpPool();
    const bdxBuyBurnPool = await uranus.bdxBuyBurnPool();
    const requiredPurchases = await uranus.purchasesRequired();

    await shed.connect(owner).setAvailableMinerTypes([4, 8, 10, 88]);
    await shed.connect(owner).activateSHED();
    await shed.connect(user505b).deployMiner(88);
    await shed.connect(user505b).deployMiner(10);
    await shed.connect(user505b).deployMiner(4);
    await shed.connect(user505b).deployMiner(8);

    for (let i = 0; i < parseInt(requiredPurchases.toString()); i++) {
        const amountOut = await getAmountOutPresale(bdx.target, titanLpPool, requiredPurchases);
        const deadline = await getDeadline(50);
        const minAmountOut = applySlippage(amountOut);
        await uranus.connect(owner).purchaseTokenForLP(bdx, minAmountOut, deadline);
    }
    {
        const amountOut = await getAmountOutPresale(hydra.target, titanLpPool, 1n);
        const deadline = await getDeadline(50);
        const minAmountOut = applySlippage(amountOut);
        await uranus.connect(owner).purchaseTokenForLP(hydra, minAmountOut, deadline);
    }
    {
        const amountOut = await getAmountOutPresale(dragonX.target, titanLpPool, 1n);
        const deadline = await getDeadline(50);
        const minAmountOut = applySlippage(amountOut);
        await uranus.connect(owner).purchaseTokenForLP(dragonX, minAmountOut, deadline);
    }
    {
        const amountOut = await getAmountOutPresale(awesomex.target, titanLpPool, 1n);
        const deadline = await getDeadline(50);
        const minAmountOut = applySlippage(amountOut);
        await uranus.connect(owner).purchaseTokenForLP(awesomex, minAmountOut, deadline);
    }
    {
        const amountOut = await getAmountOutPresale(e280.target, titanLpPool, 1n);
        const deadline = await getDeadline(50);
        const minAmountOut = applySlippage(amountOut);
        await uranus.connect(owner).purchaseTokenForLP(e280, minAmountOut, deadline);
    }

    for (let i = 0; i < parseInt(requiredPurchases.toString()); i++) {
        const amountOut = await getAmountOut(dragonX.target, bdxBuyBurnPool, requiredPurchases);
        const deadline = await getDeadline(50);
        const minAmountOut = applySlippage(amountOut);
        await uranus.connect(owner).purchaseDragonXForBuyBurn(minAmountOut, deadline);
    }

    for (let i = 0; i < tokenContracts.length; i++) {
        const token = tokenContracts[i];
        await uranus.connect(owner).deployLiquidityPool(token);
    }

    await uranus.connect(wl75).transfer(hh2, parseScale(10000000));
    await uranus.connect(wl75).transfer(hh3, parseScale(10000000));

    await passDays(8);
    const [acitveIds, instances] = await shed.getActiveMinerIds();
    for (let i = 0; i < 2; i++) {
        const minerId = acitveIds[i];
        const instance = instances[i];

        const minerInfo = await hydra.getUserMintInfo(instance, minerId);
        const timestamp = await time.latest();

        const penalty = calculateClaimPenalty(timestamp, Number(minerInfo[4]));
        const mintableHydra = calculatePercentage(minerInfo[2], 100 - penalty);
        const deadline = await getDeadline(10);
        const amountOut = await getAmountOutV3(hydra, dragonX, mintableHydra, false);
        const minAmountOutDragonX = applySlippage(amountOut);
        const dragonToTitanAmount = calculatePercentage(amountOut, 30);
        const amountOutTitan = await getAmountOutV3(dragonX, titanX, dragonToTitanAmount, false);
        const minAmountOutTitanX = applySlippage(amountOutTitan);

        await shed.connect(hh2).claimMiner(instance, minerId, minAmountOutDragonX, minAmountOutTitanX, deadline);
    }

    // const customTimestamp = Math.floor(new Date().getTime() / 1000);
    // await ethers.provider.send("evm_setNextBlockTimestamp", [customTimestamp]);
    // await ethers.provider.send("evm_setAutomine", [false]);
    // await ethers.provider.send("evm_setIntervalMining", [1000]);

    console.log("SCALE DEPLOYED TO: ", uranus.target);
    console.log("SHED DEPLOYED TO: ", shed.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
