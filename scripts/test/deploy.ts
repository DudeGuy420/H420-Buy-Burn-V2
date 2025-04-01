import { ethers } from "hardhat";
import { PRESALE_LENGTH, WETH_ADDRESS, X28_ADDRESS, X28_HOLDER_1, X28_HOLDER_2 } from "../../config/constants";
import { fundWallet, parseUranus, passDays } from "../../config/utils";

async function main() {
    const [owner, user, user2, lpWallet, distributor] = await ethers.getSigners();

    /// Tokens
    const weth = await ethers.getContractAt("IWETH9", WETH_ADDRESS);
    const x28 = await ethers.getContractAt("IERC20", X28_ADDRESS);

    const tokenFactory = await ethers.getContractFactory("Uranus");
    const uranus = await tokenFactory.deploy(owner, lpWallet, distributor);

    const buyBurnFactory = await ethers.getContractFactory("UranusBuyBurn");
    const buyburn = await buyBurnFactory.deploy(owner, uranus);

    const userX28Balance = await fundWallet(x28, X28_HOLDER_1, user);
    const user2X28Balance = await fundWallet(x28, X28_HOLDER_2, user2);

    await buyburn.connect(owner).setWhitelisted([user], true);

    // adjust time
    const customTimestamp = Math.floor(new Date().getTime() / 1000);

    await ethers.provider.send("evm_setNextBlockTimestamp", [customTimestamp]);

    await uranus.connect(owner).startPresale();
    await uranus.connect(owner).setBuyBurn(buyburn);

    console.log("uranus DEPLOYED TO: ", uranus.target);
    console.log("buyburn DEPLOYED TO: ", buyburn.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
