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
import { passDays } from "../../test/utils";
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
    const uranus = await tokenFactory.deploy(owner, mmOwner, mmOwner, mmOwner, mmOwner, BDX_BUY_BURN_ADDRESS, TOKEN_LIST, PERCENTAGE_LIST);
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

    // adjust time
    const customTimestamp = Math.floor(new Date().getTime() / 1000);

    await uranus.connect(owner).startPresale();
    await shed.connect(owner).setAvailableMinerTypes([4, 8, 10, 88]);
    await shed.connect(owner).activateSHED();
    await shed.connect(user505b).deployMiner(88);
    await shed.connect(user505b).deployMiner(4);
    await shed.connect(user505b).deployMiner(8);
    await shed.connect(user505b).deployMiner(10);

    await ethers.provider.send("evm_setNextBlockTimestamp", [customTimestamp]);
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
