import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import {
    buyBurnFixtrureE2E,
    deployFixture,
    elmntSwapFixtureUniV2Multi,
    elmntSwapFixtureUniV2Single,
    wethSwapFixtureUniV3,
    wethSwapFixtureUniV3Multi,
} from "../config/fixtures";
import {
    applyBPS,
    applySlippage,
    applyTax,
    formatTokenString,
    fundWallet,
    getDeadline,
    getPackedPath,
    getQuoteExactInput,
    getQuoteExactInputSingle,
    getQuoteV2,
} from "../config/utils";
import { ethers } from "hardhat";
import {
    E280_ADDRESS,
    ELMNT_ADDRESS,
    H420_ADDRESS,
    HLX_ADDRESS,
    POOL_FEE_1PERCENT,
    TITANX_ADDRESS,
    UNISWAP_V3_ROUTER,
    WETH9_ADDRESS,
} from "../config/constants";

describe("H420 Buy Burn V2", function () {
    describe("Deployment", function () {
        it("Should set the right addresses", async function () {
            const { buyBurn, owner } = await loadFixture(deployFixture);
            expect(await buyBurn.owner()).to.eq(owner);
        });
    });
    describe("Uniswap V2 Single Hop Token Setup", function () {
        it("Should revert on incorrect settings", async function () {
            const { buyBurn, owner } = await loadFixture(deployFixture);
            await expect(
                buyBurn.connect(owner).addUniswapV2Token(ethers.ZeroAddress, [ethers.ZeroAddress, TITANX_ADDRESS], 0, 0, 0)
            ).to.be.revertedWithCustomError(buyBurn, "ZeroAddress");
            await expect(buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [TITANX_ADDRESS], 0, 0, 0)).to.be.revertedWithCustomError(
                buyBurn,
                "IncorrectPathSettings"
            );
            await expect(
                buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [TITANX_ADDRESS, WETH9_ADDRESS], 0, 0, 0)
            ).to.be.revertedWithCustomError(buyBurn, "IncorrectPathSettings");
            await expect(buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [WETH9_ADDRESS], 0, 0, 0)).to.be.revertedWithCustomError(
                buyBurn,
                "IncorrectPathSettings"
            );
        });
        it("Should add correct settings, edit them and remove afterwards", async function () {
            const { buyBurn, owner, user } = await loadFixture(deployFixture);
            await expect(buyBurn.getSwapParams(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10)).to.be.revertedWithCustomError(
                buyBurn,
                "TokenNotEnabled"
            );
            await expect(buyBurn.connect(owner).disableToken(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [WETH9_ADDRESS, TITANX_ADDRESS], ethers.WeiPerEther, 10, 300);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(10);
                expect(swapSettings.swapType).to.eq(1);
                expect(swapSettings.capPerSwap).to.eq(ethers.WeiPerEther);
                expect(swapSettings.interval).to.eq(300);
                expect(await buyBurn.getUniswapV2Path(WETH9_ADDRESS)).to.eql([WETH9_ADDRESS, TITANX_ADDRESS]);

                const swapParams = await buyBurn.getSwapParams(WETH9_ADDRESS);
                expect(swapParams.amount).to.eq(0);
                expect(swapParams.incentive).to.eq(0);
                expect(swapParams.nextAvailable).to.eq(300);
                expect(swapParams.swapType).to.eq(1);
            }

            await expect(
                buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [WETH9_ADDRESS, TITANX_ADDRESS], ethers.WeiPerEther, 10, 300)
            ).to.be.revertedWithCustomError(buyBurn, "DuplicateSwapToken");

            await buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(10);
                expect(swapSettings.swapType).to.eq(1);
                expect(swapSettings.capPerSwap).to.eq(10);
                expect(swapSettings.interval).to.eq(10);

                const swapParams = await buyBurn.getSwapParams(WETH9_ADDRESS);
                expect(swapParams.amount).to.eq(0);
                expect(swapParams.incentive).to.eq(0);
                expect(swapParams.nextAvailable).to.eq(10);
                expect(swapParams.swapType).to.eq(1);
            }

            await buyBurn.connect(owner).disableToken(WETH9_ADDRESS);
            expect(await buyBurn.getUniswapV2Path(WETH9_ADDRESS)).to.eql([]);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(0);
                expect(swapSettings.swapType).to.eq(0);
                expect(swapSettings.capPerSwap).to.eq(0);
                expect(swapSettings.interval).to.eq(0);
            }
            await expect(buyBurn.getSwapParams(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10)).to.be.revertedWithCustomError(
                buyBurn,
                "TokenNotEnabled"
            );
            await expect(buyBurn.connect(owner).disableToken(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, 10, 10)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
        });
    });
    describe("Uniswap V2 Multi Hop Token Setup", function () {
        it("Should revert on incorrect settings", async function () {
            const { buyBurn, owner } = await loadFixture(deployFixture);
            await expect(
                buyBurn.connect(owner).addUniswapV2Token(ethers.ZeroAddress, [ethers.ZeroAddress, TITANX_ADDRESS, HLX_ADDRESS], 0, 0, 0)
            ).to.be.revertedWithCustomError(buyBurn, "ZeroAddress");
            await expect(buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [TITANX_ADDRESS], 0, 0, 0)).to.be.revertedWithCustomError(
                buyBurn,
                "IncorrectPathSettings"
            );
            await expect(
                buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [TITANX_ADDRESS, WETH9_ADDRESS, HLX_ADDRESS], 0, 0, 0)
            ).to.be.revertedWithCustomError(buyBurn, "IncorrectPathSettings");
            await expect(buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [WETH9_ADDRESS], 0, 0, 0)).to.be.revertedWithCustomError(
                buyBurn,
                "IncorrectPathSettings"
            );
        });
        it("Should add correct settings, edit them and remove afterwards", async function () {
            const { buyBurn, owner, user } = await loadFixture(deployFixture);
            await expect(buyBurn.getSwapParams(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10)).to.be.revertedWithCustomError(
                buyBurn,
                "TokenNotEnabled"
            );
            await expect(buyBurn.connect(owner).disableToken(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [WETH9_ADDRESS, TITANX_ADDRESS, HLX_ADDRESS], ethers.WeiPerEther, 10, 300);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(10);
                expect(swapSettings.swapType).to.eq(1);
                expect(swapSettings.capPerSwap).to.eq(ethers.WeiPerEther);
                expect(swapSettings.interval).to.eq(300);
                expect(await buyBurn.getUniswapV2Path(WETH9_ADDRESS)).to.eql([WETH9_ADDRESS, TITANX_ADDRESS, HLX_ADDRESS]);

                const swapParams = await buyBurn.getSwapParams(WETH9_ADDRESS);
                expect(swapParams.amount).to.eq(0);
                expect(swapParams.incentive).to.eq(0);
                expect(swapParams.nextAvailable).to.eq(300);
                expect(swapParams.swapType).to.eq(1);
            }

            await expect(
                buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [WETH9_ADDRESS, TITANX_ADDRESS], ethers.WeiPerEther, 10, 300)
            ).to.be.revertedWithCustomError(buyBurn, "DuplicateSwapToken");

            await buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(10);
                expect(swapSettings.swapType).to.eq(1);
                expect(swapSettings.capPerSwap).to.eq(10);
                expect(swapSettings.interval).to.eq(10);

                const swapParams = await buyBurn.getSwapParams(WETH9_ADDRESS);
                expect(swapParams.amount).to.eq(0);
                expect(swapParams.incentive).to.eq(0);
                expect(swapParams.nextAvailable).to.eq(10);
                expect(swapParams.swapType).to.eq(1);
            }

            await buyBurn.connect(owner).disableToken(WETH9_ADDRESS);
            expect(await buyBurn.getUniswapV2Path(WETH9_ADDRESS)).to.eql([]);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(0);
                expect(swapSettings.swapType).to.eq(0);
                expect(swapSettings.capPerSwap).to.eq(0);
                expect(swapSettings.interval).to.eq(0);
            }
            await expect(buyBurn.getSwapParams(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10)).to.be.revertedWithCustomError(
                buyBurn,
                "TokenNotEnabled"
            );
            await expect(buyBurn.connect(owner).disableToken(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, 10, 10)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
        });
    });
    describe("Uniswap V3 Single Hop Token Setup", function () {
        it("Should revert on incorrect settings", async function () {
            const { buyBurn, owner } = await loadFixture(deployFixture);
            await expect(
                buyBurn.connect(owner).addUniswapV3Token(ethers.ZeroAddress, TITANX_ADDRESS, POOL_FEE_1PERCENT, 0, 0, 0)
            ).to.be.revertedWithCustomError(buyBurn, "ZeroAddress");
            await expect(
                buyBurn.connect(owner).addUniswapV3Token(WETH9_ADDRESS, ethers.ZeroAddress, POOL_FEE_1PERCENT, 0, 0, 0)
            ).to.be.revertedWithCustomError(buyBurn, "ZeroAddress");
        });
        it("Should add correct settings, edit them and remove afterwards", async function () {
            const { buyBurn, owner, user } = await loadFixture(deployFixture);
            await expect(buyBurn.getSwapParams(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10)).to.be.revertedWithCustomError(
                buyBurn,
                "TokenNotEnabled"
            );
            await expect(buyBurn.connect(owner).disableToken(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await buyBurn.connect(owner).addUniswapV3Token(WETH9_ADDRESS, TITANX_ADDRESS, POOL_FEE_1PERCENT, ethers.WeiPerEther, 10, 300);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(10);
                expect(swapSettings.swapType).to.eq(2);
                expect(swapSettings.capPerSwap).to.eq(ethers.WeiPerEther);
                expect(swapSettings.interval).to.eq(300);

                const route = await buyBurn.swapOptionsV3(WETH9_ADDRESS);
                expect(route.tokenOut).to.eq(TITANX_ADDRESS);
                expect(route.fee).to.eq(POOL_FEE_1PERCENT);
                expect(await buyBurn.isMultihopSwap(WETH9_ADDRESS)).to.eq(false);

                const swapParams = await buyBurn.getSwapParams(WETH9_ADDRESS);
                expect(swapParams.amount).to.eq(0);
                expect(swapParams.incentive).to.eq(0);
                expect(swapParams.nextAvailable).to.eq(300);
                expect(swapParams.swapType).to.eq(2);
            }

            await expect(
                buyBurn.connect(owner).addUniswapV3Token(WETH9_ADDRESS, TITANX_ADDRESS, POOL_FEE_1PERCENT, ethers.WeiPerEther, 10, 300)
            ).to.be.revertedWithCustomError(buyBurn, "DuplicateSwapToken");
            await expect(
                buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [WETH9_ADDRESS, TITANX_ADDRESS], ethers.WeiPerEther, 10, 300)
            ).to.be.revertedWithCustomError(buyBurn, "DuplicateSwapToken");

            await buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(10);
                expect(swapSettings.capPerSwap).to.eq(10);
                expect(swapSettings.interval).to.eq(10);
                expect(swapSettings.swapType).to.eq(2);

                const swapParams = await buyBurn.getSwapParams(WETH9_ADDRESS);
                expect(swapParams.amount).to.eq(0);
                expect(swapParams.incentive).to.eq(0);
                expect(swapParams.nextAvailable).to.eq(10);
                expect(swapParams.swapType).to.eq(2);
            }

            await buyBurn.connect(owner).disableToken(WETH9_ADDRESS);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(0);
                expect(swapSettings.swapType).to.eq(0);
                expect(swapSettings.capPerSwap).to.eq(0);
                expect(swapSettings.interval).to.eq(0);

                const route = await buyBurn.swapOptionsV3(WETH9_ADDRESS);
                expect(route.tokenOut).to.eq(ethers.ZeroAddress);
                expect(route.fee).to.eq(0);
                expect(await buyBurn.isMultihopSwap(WETH9_ADDRESS)).to.eq(false);
            }
            await expect(buyBurn.getSwapParams(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10)).to.be.revertedWithCustomError(
                buyBurn,
                "TokenNotEnabled"
            );
            await expect(buyBurn.connect(owner).disableToken(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, 10, 10)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
        });
    });
    describe("Uniswap V3 Multi Hop Token Setup", function () {
        it("Should revert on incorrect settings", async function () {
            const { buyBurn, owner } = await loadFixture(deployFixture);
            await expect(
                buyBurn
                    .connect(owner)
                    .addUniswapV3MultihopToken(
                        ethers.ZeroAddress,
                        getPackedPath([WETH9_ADDRESS, TITANX_ADDRESS, HLX_ADDRESS], [POOL_FEE_1PERCENT, POOL_FEE_1PERCENT]),
                        0,
                        0,
                        0
                    )
            ).to.be.revertedWithCustomError(buyBurn, "ZeroAddress");
        });
        it("Should add correct settings, edit them and remove afterwards", async function () {
            const { buyBurn, owner, user } = await loadFixture(deployFixture);
            const path = getPackedPath([WETH9_ADDRESS, TITANX_ADDRESS, HLX_ADDRESS], [POOL_FEE_1PERCENT, POOL_FEE_1PERCENT]);
            await expect(buyBurn.getSwapParams(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10)).to.be.revertedWithCustomError(
                buyBurn,
                "TokenNotEnabled"
            );
            await expect(buyBurn.connect(owner).disableToken(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await buyBurn.connect(owner).addUniswapV3MultihopToken(WETH9_ADDRESS, path, ethers.WeiPerEther, 10, 300);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(10);
                expect(swapSettings.swapType).to.eq(2);
                expect(swapSettings.capPerSwap).to.eq(ethers.WeiPerEther);
                expect(swapSettings.interval).to.eq(300);

                const route = await buyBurn.swapOptionsV3(WETH9_ADDRESS);
                expect(route.tokenOut).to.eq(ethers.ZeroAddress);
                expect(route.fee).to.eq(0);
                expect(await buyBurn.isMultihopSwap(WETH9_ADDRESS)).to.eq(true);
                expect(await buyBurn.multihopSwapOptionsV3(WETH9_ADDRESS)).to.eq(path);

                const swapParams = await buyBurn.getSwapParams(WETH9_ADDRESS);
                expect(swapParams.amount).to.eq(0);
                expect(swapParams.incentive).to.eq(0);
                expect(swapParams.nextAvailable).to.eq(300);
                expect(swapParams.swapType).to.eq(2);
            }

            await expect(
                buyBurn.connect(owner).addUniswapV3Token(WETH9_ADDRESS, TITANX_ADDRESS, POOL_FEE_1PERCENT, ethers.WeiPerEther, 10, 300)
            ).to.be.revertedWithCustomError(buyBurn, "DuplicateSwapToken");
            await expect(
                buyBurn.connect(owner).addUniswapV2Token(WETH9_ADDRESS, [WETH9_ADDRESS, TITANX_ADDRESS], ethers.WeiPerEther, 10, 300)
            ).to.be.revertedWithCustomError(buyBurn, "DuplicateSwapToken");
            await expect(
                buyBurn.connect(owner).addUniswapV3MultihopToken(WETH9_ADDRESS, path, ethers.WeiPerEther, 10, 300)
            ).to.be.revertedWithCustomError(buyBurn, "DuplicateSwapToken");

            await buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(10);
                expect(swapSettings.capPerSwap).to.eq(10);
                expect(swapSettings.interval).to.eq(10);
                expect(swapSettings.swapType).to.eq(2);

                const route = await buyBurn.swapOptionsV3(WETH9_ADDRESS);
                expect(route.tokenOut).to.eq(ethers.ZeroAddress);
                expect(route.fee).to.eq(0);
                expect(await buyBurn.isMultihopSwap(WETH9_ADDRESS)).to.eq(true);
                expect(await buyBurn.multihopSwapOptionsV3(WETH9_ADDRESS)).to.eq(path);

                const swapParams = await buyBurn.getSwapParams(WETH9_ADDRESS);
                expect(swapParams.amount).to.eq(0);
                expect(swapParams.incentive).to.eq(0);
                expect(swapParams.nextAvailable).to.eq(10);
                expect(swapParams.swapType).to.eq(2);
            }

            await buyBurn.connect(owner).disableToken(WETH9_ADDRESS);
            {
                const swapSettings = await buyBurn.swapSettings(WETH9_ADDRESS);
                expect(swapSettings.incentiveBps).to.eq(0);
                expect(swapSettings.swapType).to.eq(0);
                expect(swapSettings.capPerSwap).to.eq(0);
                expect(swapSettings.interval).to.eq(0);

                const route = await buyBurn.swapOptionsV3(WETH9_ADDRESS);
                expect(route.tokenOut).to.eq(ethers.ZeroAddress);
                expect(route.fee).to.eq(0);
                expect(await buyBurn.isMultihopSwap(WETH9_ADDRESS)).to.eq(false);
                expect(await buyBurn.multihopSwapOptionsV3(WETH9_ADDRESS)).to.eq("0x");
            }
            await expect(buyBurn.getSwapParams(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 10, 10, 10)).to.be.revertedWithCustomError(
                buyBurn,
                "TokenNotEnabled"
            );
            await expect(buyBurn.connect(owner).disableToken(WETH9_ADDRESS)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, 10, 10)).to.be.revertedWithCustomError(buyBurn, "TokenNotEnabled");
        });
    });
    describe("Uniswap V2 single elmnt swap", function () {
        it("Should revert on 0 balance", async function () {
            const { buyBurn, user, owner } = await loadFixture(deployFixture);
            await buyBurn.connect(owner).addUniswapV2Token(ELMNT_ADDRESS, [ELMNT_ADDRESS, TITANX_ADDRESS], 100, 100, 100);
            await expect(buyBurn.connect(user).swapToken(ELMNT_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "InsufficientBalance");
        });
        it("Should revert on 0 capPerSwap", async function () {
            const { buyBurn, owner, user } = await loadFixture(elmntSwapFixtureUniV2Single);
            await buyBurn.connect(owner).editTokenSettings(ELMNT_ADDRESS, 0, 10, 300);
            await expect(buyBurn.connect(user).swapToken(ELMNT_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "InsufficientBalance");
        });
        it("Should revert on non-wl wallet", async function () {
            const { buyBurn, user2 } = await loadFixture(elmntSwapFixtureUniV2Single);
            await expect(buyBurn.connect(user2).swapToken(ELMNT_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "Unauthorized");
        });
        it("Should perform a swap ELMNT => TITANX", async function () {
            const { elmnt, titanx, buyBurn, user, elmntBalance, elmntCapPerSwap, elmntIncentiveBps, elmntInterval } = await loadFixture(
                elmntSwapFixtureUniV2Single
            );

            expect(elmntBalance).to.be.greaterThan(elmntCapPerSwap);
            expect(await elmnt.balanceOf(buyBurn)).to.eq(elmntBalance);

            const [callAmount, incentive, nextTime, swapType] = await buyBurn.getSwapParams(ELMNT_ADDRESS);
            expect(callAmount).to.eq(elmntCapPerSwap);
            expect(incentive).to.eq(applyBPS(callAmount, elmntIncentiveBps));
            expect(nextTime).to.eq(elmntInterval);
            expect(swapType).to.eq(1);

            const swapAmount = callAmount - incentive;
            const swapAmountAfterFees = applyTax(swapAmount);
            const amountOut = await getQuoteV2([ELMNT_ADDRESS, TITANX_ADDRESS], swapAmountAfterFees);

            const minAmount = applySlippage(amountOut);
            await expect(buyBurn.connect(user).swapToken(ELMNT_ADDRESS, minAmount, await getDeadline())).to.changeTokenBalances(
                elmnt,
                [buyBurn, user],
                [-callAmount, applyTax(incentive)]
            );
            expect(await titanx.balanceOf(buyBurn)).to.eq(amountOut);
            await expect(buyBurn.connect(user).swapToken(ELMNT_ADDRESS, minAmount, await getDeadline())).to.be.revertedWithCustomError(
                buyBurn,
                "Cooldown"
            );
        });
    });
    describe("Uniswap V2 multi elmnt swap", function () {
        it("Should revert on 0 balance", async function () {
            const { buyBurn, user, owner } = await loadFixture(deployFixture);
            await buyBurn.connect(owner).addUniswapV2Token(ELMNT_ADDRESS, [ELMNT_ADDRESS, TITANX_ADDRESS, WETH9_ADDRESS], 100, 100, 100);
            await expect(buyBurn.connect(user).swapToken(ELMNT_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "InsufficientBalance");
        });
        it("Should revert on 0 capPerSwap", async function () {
            const { buyBurn, owner, user } = await loadFixture(elmntSwapFixtureUniV2Multi);
            await buyBurn.connect(owner).editTokenSettings(ELMNT_ADDRESS, 0, 10, 300);
            await expect(buyBurn.connect(user).swapToken(ELMNT_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "InsufficientBalance");
        });
        it("Should revert on non-wl wallet", async function () {
            const { buyBurn, user2 } = await loadFixture(elmntSwapFixtureUniV2Multi);
            await expect(buyBurn.connect(user2).swapToken(ELMNT_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "Unauthorized");
        });
        it("Should perform a swap ELMNT => TITANX => WETH", async function () {
            const { elmnt, weth, buyBurn, user, elmntBalance, elmntCapPerSwap, elmntIncentiveBps, elmntInterval } = await loadFixture(
                elmntSwapFixtureUniV2Multi
            );

            expect(elmntBalance).to.be.greaterThan(elmntCapPerSwap);
            expect(await elmnt.balanceOf(buyBurn)).to.eq(elmntBalance);

            const [callAmount, incentive, nextTime, swapType] = await buyBurn.getSwapParams(ELMNT_ADDRESS);
            expect(callAmount).to.eq(elmntCapPerSwap);
            expect(incentive).to.eq(applyBPS(callAmount, elmntIncentiveBps));
            expect(nextTime).to.eq(elmntInterval);
            expect(swapType).to.eq(1);

            const swapAmount = callAmount - incentive;
            const swapAmountAfterFees = applyTax(swapAmount);
            const amountOut = await getQuoteV2([ELMNT_ADDRESS, TITANX_ADDRESS, WETH9_ADDRESS], swapAmountAfterFees);

            const minAmount = applySlippage(amountOut);
            await expect(buyBurn.connect(user).swapToken(ELMNT_ADDRESS, minAmount, await getDeadline())).to.changeTokenBalances(
                elmnt,
                [buyBurn, user],
                [-callAmount, applyTax(incentive)]
            );
            expect(await weth.balanceOf(buyBurn)).to.eq(amountOut);
            await expect(buyBurn.connect(user).swapToken(ELMNT_ADDRESS, minAmount, await getDeadline())).to.be.revertedWithCustomError(
                buyBurn,
                "Cooldown"
            );
        });
        it("Should perform a swap WETH => TITANX => ELMNT => E280", async function () {
            const { elmnt, e280, weth, buyBurn, user, owner } = await loadFixture(deployFixture);

            const wethCapPerSwap = ethers.WeiPerEther;
            const wethIncentiveBps = 100;
            const wethInterval = 300;
            const wethBalance = 3n * ethers.WeiPerEther;
            await buyBurn.connect(owner).addUniswapV2Token(weth, [weth, TITANX_ADDRESS, elmnt, e280], wethCapPerSwap, wethIncentiveBps, wethInterval);
            await user.sendTransaction({ to: buyBurn, value: wethBalance });

            expect(wethBalance).to.be.greaterThan(wethCapPerSwap);
            expect(await weth.balanceOf(buyBurn)).to.eq(wethBalance);

            const [callAmount, incentive, nextTime, swapType] = await buyBurn.getSwapParams(WETH9_ADDRESS);
            expect(callAmount).to.eq(wethCapPerSwap);
            expect(incentive).to.eq(applyBPS(callAmount, wethIncentiveBps));
            expect(nextTime).to.eq(wethInterval);
            expect(swapType).to.eq(1);

            const swapAmount = callAmount - incentive;
            const amountOut = await getQuoteV2([WETH9_ADDRESS, TITANX_ADDRESS, ELMNT_ADDRESS, E280_ADDRESS], swapAmount);

            const minAmount = applySlippage(amountOut, 900);
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, minAmount, await getDeadline())).to.changeTokenBalances(
                weth,
                [buyBurn, user],
                [-callAmount, incentive]
            );
            expect(await e280.balanceOf(buyBurn)).to.approximately(amountOut, applyBPS(amountOut, 800));
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, minAmount, await getDeadline())).to.be.revertedWithCustomError(
                buyBurn,
                "Cooldown"
            );
        });
    });
    describe("Uniswap V3 single Weth swap", function () {
        it("Should revert on 0 balance", async function () {
            const { buyBurn, user, owner } = await loadFixture(deployFixture);
            await buyBurn.connect(owner).addUniswapV3Token(WETH9_ADDRESS, TITANX_ADDRESS, POOL_FEE_1PERCENT, 10, 10, 10);
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "InsufficientBalance");
        });
        it("Should revert on 0 capPerSwap", async function () {
            const { buyBurn, owner, user } = await loadFixture(wethSwapFixtureUniV3);
            await buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 0, 10, 300);
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "InsufficientBalance");
        });
        it("Should revert on non-wl wallet", async function () {
            const { buyBurn, user2 } = await loadFixture(wethSwapFixtureUniV3);
            await expect(buyBurn.connect(user2).swapToken(WETH9_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "Unauthorized");
        });
        it("Should perform a swap WETH => TITANX", async function () {
            const { weth, titanx, buyBurn, user, wethBalance, wethCapPerSwap, wethIncentiveBps, wethInterval } = await loadFixture(
                wethSwapFixtureUniV3
            );

            expect(wethBalance).to.be.greaterThan(wethCapPerSwap);
            expect(await weth.balanceOf(buyBurn)).to.eq(wethBalance);

            const [callAmount, incentive, nextTime, swapType] = await buyBurn.getSwapParams(WETH9_ADDRESS);
            expect(callAmount).to.eq(wethCapPerSwap);
            expect(incentive).to.eq(applyBPS(callAmount, wethIncentiveBps));
            expect(nextTime).to.eq(wethInterval);
            expect(swapType).to.eq(2);

            const swapAmount = callAmount - incentive;
            const amountOut = await getQuoteExactInputSingle(WETH9_ADDRESS, TITANX_ADDRESS, swapAmount);

            const minAmount = applySlippage(amountOut);
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, minAmount, await getDeadline())).to.changeTokenBalances(
                weth,
                [buyBurn, user],
                [-callAmount, incentive]
            );
            expect(await titanx.balanceOf(buyBurn)).to.eq(amountOut);
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, minAmount, await getDeadline())).to.be.revertedWithCustomError(
                buyBurn,
                "Cooldown"
            );
        });
    });
    describe("Uniswap V3 multi Weth swap", function () {
        it("Should revert on 0 balance", async function () {
            const { buyBurn, user, owner } = await loadFixture(deployFixture);
            const path = getPackedPath([WETH9_ADDRESS, TITANX_ADDRESS, HLX_ADDRESS], [POOL_FEE_1PERCENT, POOL_FEE_1PERCENT]);
            await buyBurn.connect(owner).addUniswapV3MultihopToken(WETH9_ADDRESS, path, 10, 10, 10);
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "InsufficientBalance");
        });
        it("Should revert on 0 capPerSwap", async function () {
            const { buyBurn, owner, user } = await loadFixture(wethSwapFixtureUniV3Multi);
            await buyBurn.connect(owner).editTokenSettings(WETH9_ADDRESS, 0, 10, 300);
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "InsufficientBalance");
        });
        it("Should revert on non-wl wallet", async function () {
            const { buyBurn, user2 } = await loadFixture(wethSwapFixtureUniV3Multi);
            await expect(buyBurn.connect(user2).swapToken(WETH9_ADDRESS, 0, 0)).to.be.revertedWithCustomError(buyBurn, "Unauthorized");
        });
        it("Should perform a swap WETH => TITANX => HLX swap", async function () {
            const { weth, hlx, buyBurn, user, wethBalance, wethCapPerSwap, wethIncentiveBps, wethInterval, wethPath } = await loadFixture(
                wethSwapFixtureUniV3Multi
            );

            expect(wethBalance).to.be.greaterThan(wethCapPerSwap);
            expect(await weth.balanceOf(buyBurn)).to.eq(wethBalance);

            const [callAmount, incentive, nextTime, swapType] = await buyBurn.getSwapParams(WETH9_ADDRESS);
            expect(callAmount).to.eq(wethCapPerSwap);
            expect(incentive).to.eq(applyBPS(callAmount, wethIncentiveBps));
            expect(nextTime).to.eq(wethInterval);
            expect(swapType).to.eq(2);

            const swapAmount = callAmount - incentive;
            const amountOut = await getQuoteExactInput(wethPath, swapAmount);

            const minAmount = applySlippage(amountOut);
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, minAmount, await getDeadline())).to.changeTokenBalances(
                weth,
                [buyBurn, user],
                [-callAmount, incentive]
            );
            expect(await hlx.balanceOf(buyBurn)).to.eq(amountOut);
            await expect(buyBurn.connect(user).swapToken(WETH9_ADDRESS, minAmount, await getDeadline())).to.be.revertedWithCustomError(
                buyBurn,
                "Cooldown"
            );
        });
    });
    describe("Buy Burn", function () {
        it("Should revert on 0 balance", async function () {
            const { buyBurn, user } = await loadFixture(deployFixture);
            await expect(buyBurn.connect(user).buyAndBurn(0, 0)).to.be.revertedWithCustomError(buyBurn, "InsufficientBalance");
        });
        it("Should revert on 0 capPerSwap", async function () {
            const { buyBurn, owner, user } = await loadFixture(buyBurnFixtrureE2E);
            await buyBurn.connect(owner).setCapPerSwapBuyBurn(0);
            await expect(buyBurn.connect(user).buyAndBurn(0, 0)).to.be.revertedWithCustomError(buyBurn, "InsufficientBalance");
        });
        it("Should revert on low minAmountOut", async function () {
            const { buyBurn, user } = await loadFixture(buyBurnFixtrureE2E);

            const [callAmount, incentive, nextTime] = await buyBurn.getBuyBurnParams();
            const swapAmount = callAmount - incentive;

            const amountOut = await getQuoteV2([E280_ADDRESS, H420_ADDRESS], swapAmount);
            const minAmount = applySlippage(amountOut);
            await expect(buyBurn.connect(user).buyAndBurn(minAmount, await getDeadline())).to.be.revertedWith(
                "UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT"
            );
        });
        it("Should buy and burn", async function () {
            const { e280, h420, buyBurn, user, e280Balance, e280CapPerSwap, e280IncentiveBps, e280Interval } = await loadFixture(buyBurnFixtrureE2E);

            expect(e280Balance).to.be.greaterThan(e280CapPerSwap);
            const burnedBefore = await h420.totalBurned();

            const [callAmount, incentive, nextTime] = await buyBurn.getBuyBurnParams();
            expect(callAmount).to.eq(e280CapPerSwap);
            expect(incentive).to.eq(applyBPS(callAmount, e280IncentiveBps));
            expect(nextTime).to.eq(e280Interval);
            const swapAmount = callAmount - incentive;
            const swapAmountAfterFees = applyTax(swapAmount);

            const amountOut = await getQuoteV2([E280_ADDRESS, H420_ADDRESS], swapAmountAfterFees);
            const amountOutAfterFees = applyTax(amountOut);
            const minAmount = applySlippage(amountOutAfterFees);

            await expect(buyBurn.connect(user).buyAndBurn(minAmount, await getDeadline())).to.changeTokenBalances(
                e280,
                [buyBurn, user],
                [-callAmount, applyTax(incentive)]
            );
            expect(await h420.totalBurned()).to.eq(amountOut + burnedBefore);
            expect(await h420.balanceOf(buyBurn)).to.eq(0);
            await expect(buyBurn.connect(user).buyAndBurn(minAmount, await getDeadline())).to.be.revertedWithCustomError(buyBurn, "Cooldown");
        });
    });
    describe("TitanX Price", function () {
        it("Should return same titanx price", async function () {
            const { buyBurn } = await loadFixture(deployFixture);
            const oldBuyBurn = await ethers.getContractAt("H420BuyBurnV2", "0x9Bff9F810D19cDb4BF7701C9d5aD101E91CdA08d");
            expect(await oldBuyBurn.getCurrentTitanPrice()).to.eq(await buyBurn.getCurrentTitanPrice());
        });
        it("Should return same titanx price on price change HLX purchase", async function () {
            const { buyBurn, user, titanx } = await loadFixture(deployFixture);
            const userBalance = await fundWallet(titanx, "0x99964dC2D5fb3590ae3F548675C4268F0EC4714A", user);
            console.log(formatTokenString(userBalance));
            const routerV3 = await ethers.getContractAt("ISwapRouter", UNISWAP_V3_ROUTER);
            await titanx.connect(user).approve(routerV3, userBalance);
            await routerV3.connect(user).exactInputSingle({
                tokenIn: TITANX_ADDRESS,
                tokenOut: HLX_ADDRESS,
                fee: POOL_FEE_1PERCENT,
                recipient: user.address,
                deadline: await getDeadline(),
                amountIn: userBalance,
                amountOutMinimum: 0n,
                sqrtPriceLimitX96: 0,
            });
            const oldBuyBurn = await ethers.getContractAt("H420BuyBurnV2", "0x9Bff9F810D19cDb4BF7701C9d5aD101E91CdA08d");
            expect(await oldBuyBurn.getCurrentTitanPrice()).to.eq(await buyBurn.getCurrentTitanPrice());
        });
        it("Should return same titanx price on price change HLX sell", async function () {
            const { buyBurn, user, hlx } = await loadFixture(deployFixture);
            const userBalance = await fundWallet(hlx, "0xCBcF2B2D00D603BbAb0f579Cc3DFa207f4Fcd1df", user);
            console.log(formatTokenString(userBalance));
            const routerV3 = await ethers.getContractAt("ISwapRouter", UNISWAP_V3_ROUTER);
            await hlx.connect(user).approve(routerV3, userBalance);
            await routerV3.connect(user).exactInputSingle({
                tokenIn: HLX_ADDRESS,
                tokenOut: TITANX_ADDRESS,
                fee: POOL_FEE_1PERCENT,
                recipient: user.address,
                deadline: await getDeadline(),
                amountIn: userBalance,
                amountOutMinimum: 0n,
                sqrtPriceLimitX96: 0,
            });
            const oldBuyBurn = await ethers.getContractAt("H420BuyBurnV2", "0x9Bff9F810D19cDb4BF7701C9d5aD101E91CdA08d");
            expect(await oldBuyBurn.getCurrentTitanPrice()).to.eq(await buyBurn.getCurrentTitanPrice());
        });
    });
});
