import { ethers, run } from "hardhat";
const OWNER = "0x9B3ba6b585188d5b0510DDbB26681CF7233c96B0";

async function main() {
    // const factory = await ethers.getContractFactory("H420BuyBurnV2");
    // const contract = await factory.deploy(OWNER);
    // console.log("H420BuyBurnV2 deployed to: ", contract.target);

    await run("verify:verify", {
        address: "0xca4e480eA307d6881B3A423157E55A9682D6fd15",
        constructorArguments: [OWNER],
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
