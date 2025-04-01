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
import { applySlippage, getAmountOutV3, getDeadline } from "../../test/utils";
const SHED = "0x32dfA14e01F37fFdE834bb98f7B98c823De46704";
const OWNER = "0x9B3ba6b585188d5b0510DDbB26681CF7233c96B0";

async function main() {
    const [owner] = await ethers.getSigners();
    /// Tokens
    const titanX = await ethers.getContractAt("ITITANX", TITANX_ADDRESS);
    const dragonX = await ethers.getContractAt("IERC20", DRAGONX_ADDRESS);
    const bdx = await ethers.getContractAt("IERC20", BDX_ADDRESS);
    const hydra = await ethers.getContractAt("IHydra", HYDRA_ADDRESS);
    const awesomex = await ethers.getContractAt("IERC20", AWESOMEX_ADDRESS);
    const e280 = await ethers.getContractAt("IERC20", E280_ADDRESS);

    const tokenFactory = await ethers.getContractFactory("SCALE");
    const shed = await ethers.getContractAt("SHED", SHED);

    const _activeInstance = await shed.activeInstance();
    const activeInstance = await ethers.getContractAt("SHEDMiner", _activeInstance);
    const tokenContracts = [bdx, dragonX, hydra, awesomex, e280];

    const instance = await shed.activeInstance();
    const reinvestPercentage = await shed.reinvestPercentage();
    const minerInfo = await hydra.getUserMintInfo(instance, 2);
    console.log(minerInfo);
    const penalty = calculateClaimPenalty(Number(minerInfo[4]));
    console.log("penalty: ", penalty);
    const mintableHydra = applyPercentage(minerInfo[2], 100 - penalty);
    const deadline = await getDeadline(300);
    const amountOut = await getAmountOutV3(HYDRA_ADDRESS, DRAGONX_ADDRESS, mintableHydra);
    const minAmountOutDragonX = applySlippage(amountOut);
    const dragonToTitanAmount = applyPercentage(amountOut, Number(reinvestPercentage) / 100);
    const amountOutTitan = await getAmountOutV3(DRAGONX_ADDRESS, TITANX_ADDRESS, dragonToTitanAmount);
    const minAmountOutTitanX = applySlippage(amountOutTitan);

    const claimReq = await shed.claimMiner(instance, 2, minAmountOutDragonX, minAmountOutTitanX, deadline);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

function calculateClaimPenalty(maturity: number) {
    const now = Math.round(Date.now() / 1000);
    const secsLate = now - maturity;
    if (secsLate <= 7 * 86400) return 0;
    if (secsLate <= (7 + 1) * 86400) return 1;
    if (secsLate <= (7 + 2) * 86400) return 3;
    if (secsLate <= (7 + 3) * 86400) return 8;
    if (secsLate <= (7 + 4) * 86400) return 17;
    if (secsLate <= (7 + 5) * 86400) return 35;
    if (secsLate <= (7 + 6) * 86400) return 72;
    return 99;
}

function applyPercentage(amount: bigint, percent: number) {
    return (amount * BigInt(Math.floor(percent * 100))) / 10000n;
}
