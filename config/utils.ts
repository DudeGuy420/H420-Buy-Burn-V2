import quoterV2Abi from "@uniswap/v3-periphery/artifacts/contracts/interfaces/IQuoterV2.sol/IQuoterV2.json";
import routerAbi from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers, network } from "hardhat";
import { DEBUG, POOL_FEE_1PERCENT, QUOTER_V3_ADDRESS, UNISWAP_V2_ROUTER } from "./constants";

export function parseUranus(value: number) {
    return ethers.parseUnits(value.toString(), 9);
}

export async function makeSnapshot() {
    return await network.provider.send("evm_snapshot");
}

export async function revertSnaphsot(snaphot: any) {
    await network.provider.send("evm_revert", [snaphot]);
    return makeSnapshot();
}

export function generateSequence(num: number, start: number = 1) {
    return Array.from({ length: num }, (_, i) => i + start);
}

export async function getDeadline(seconds: number = 100) {
    const timestamp = await time.latest();
    return timestamp + seconds;
}

export function createRandomTierArray(size: number, maxValue = 8) {
    return Array.from({ length: size }, () => Math.floor(Math.random() * maxValue) + 1);
}

export function applyTax(amount: bigint, tax: number | bigint = 400) {
    return amount - applyBPS(amount, tax);
}

export function applyPercentage(amount: bigint, percentage: number | bigint) {
    return (amount * BigInt(percentage)) / 100n;
}

export function applySlippage(amount: bigint, slippageBps: number | bigint = 100) {
    return applyBPS(amount, 10000n - BigInt(slippageBps));
}

export function applyMaxAmountSlippage(amount: bigint, slippageBps: number | bigint = 100) {
    return applyBPS(amount, 10000n + BigInt(slippageBps));
}

export function applyBPS(amount: bigint, bps: number | bigint) {
    return (amount * BigInt(bps)) / 10000n;
}

export async function passDays(days: number, delta: number = 0) {
    await time.increase(86400 * days + delta);
}

export async function passHours(hours: number, delta: number = 0) {
    await time.increase(3600 * hours + delta);
}

export async function fundWallet(token: any, userFrom: string, userTo: any) {
    const user = await ethers.getImpersonatedSigner(userFrom);
    await userTo.sendTransaction({ value: ethers.parseEther("0.5"), to: user });
    const balance = await token.balanceOf(user);
    await token.connect(user).transfer(userTo, balance);
    const newBalance = await token.balanceOf(userTo);
    if (newBalance === 0n) throw new Error(`Zero balance for user ...${userFrom.slice(-5)}`);
    return newBalance;
}

export async function getQuoteExactOutputSingle(tokenIn: string, tokenOut: string, amountOut: bigint, showValues: boolean = false): Promise<bigint> {
    const data = {
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        amount: amountOut,
        fee: POOL_FEE_1PERCENT,
        sqrtPriceLimitX96: 0n,
    };
    const quoterV2 = new ethers.Contract(QUOTER_V3_ADDRESS, quoterV2Abi.abi, ethers.provider);
    const [amountIn, sqrtPriceX96AfterList, _initializedTicksCrossedList, gasEstimate] = await quoterV2.quoteExactOutputSingle.staticCallResult(data);
    if (showValues || DEBUG) {
        console.log("Amount Out:", formatTokenString(amountOut));
        console.log("Estimated Amount In:", formatTokenString(amountIn));
    }

    return amountIn;
}
export async function getQuoteExactInputSingle(tokenIn: string, tokenOut: string, amountIn: bigint, showValues: boolean = false): Promise<bigint> {
    const data = {
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        amountIn: amountIn,
        fee: POOL_FEE_1PERCENT,
        sqrtPriceLimitX96: 0n,
    };
    const quoterV2 = new ethers.Contract(QUOTER_V3_ADDRESS, quoterV2Abi.abi, ethers.provider);
    const [amountOut, sqrtPriceX96AfterList, _initializedTicksCrossedList, gasEstimate] = await quoterV2.quoteExactInputSingle.staticCallResult(data);
    if (showValues || DEBUG) {
        console.log("Amount In:", formatTokenString(amountIn));
        console.log("Estimated Amount Out:", formatTokenString(amountOut));
    }

    return amountOut;
}

export async function getQuoteV2(path: any[], amountIn: bigint, showValues: boolean = false) {
    const routerV2 = new ethers.Contract(UNISWAP_V2_ROUTER, routerAbi.abi, ethers.provider);
    const amounts = await routerV2.getAmountsOut(amountIn, path);
    if (showValues) {
        console.log("Amount in: ", ethers.formatEther(amountIn));
        console.log("Estimated amount out:", ethers.formatEther(amounts[path.length - 1]));
    }

    return amounts[path.length - 1];
}

export function getPackedPath(path: string[], fees: number[]) {
    let types: string[] = [];
    let addresses: any[] = [];
    for (let i = 0; i < path.length; i++) {
        types.push("address");
        addresses.push(path[i]);
        if (i != path.length - 1) {
            types.push("uint24");
            addresses.push(fees[i]);
        }
    }

    return ethers.solidityPacked(types, addresses);
}

export async function getQuoteExactInput(path: string, amountIn: bigint, showValues: boolean = false) {
    const quoterV2 = new ethers.Contract(QUOTER_V3_ADDRESS, quoterV2Abi.abi, ethers.provider);
    const [amountOut, sqrtPriceX96AfterList, _initializedTicksCrossedList, gasEstimate] = await quoterV2.quoteExactInput.staticCallResult(
        path,
        amountIn
    );
    if (showValues) {
        console.log("Amount in: ", ethers.formatEther(amountIn));
        console.log("Estimated amount out:", ethers.formatEther(amountOut));
        console.log("Price after swap:", sqrtPriceX96AfterList.toString());
        console.log("Estimated gas:", gasEstimate.toString());
    }

    return amountOut;
}

export async function getQuoteExactInputCustomFees(path: string[], fees: number[], amountIn: bigint, showValues: boolean = false) {
    const _path = getPackedPath(path, fees);
    const quoterV2 = new ethers.Contract(QUOTER_V3_ADDRESS, quoterV2Abi.abi, ethers.provider);
    const [amountOut, sqrtPriceX96AfterList, _initializedTicksCrossedList, gasEstimate] = await quoterV2.quoteExactInput.staticCallResult(
        _path,
        amountIn
    );
    if (showValues) {
        console.log("Amount in: ", ethers.formatEther(amountIn));
        console.log("Estimated amount out:", ethers.formatEther(amountOut));
        console.log("Price after swap:", sqrtPriceX96AfterList.toString());
        console.log("Estimated gas:", gasEstimate.toString());
    }

    return amountOut;
}

export function formatTokenString(value_: string | bigint) {
    const value = typeof value_ === "string" ? ethers.parseEther(value_) : value_;
    if (value === 0n) return "0";
    const lowerLimit = 1n * 10n ** 15n; // 0.001 ETH in Wei
    if (value > 0 && value < lowerLimit) {
        return "<0.001";
    }
    const numberString = ethers.formatEther(value);
    const [whole, decimal] = numberString.split(".");

    let reversedWhole = whole.split("").reverse().join("");
    let spacedWhole = reversedWhole.match(/.{1,3}/g)!.join(",");
    let formattedWhole = spacedWhole.split("").reverse().join("");

    let formattedDecimal = decimal ? (decimal !== "0" ? "." + decimal.slice(0, 3) : "") : "";
    if (formattedDecimal === ".000") formattedDecimal = "";
    return formattedWhole + formattedDecimal;
}
