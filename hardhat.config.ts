import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require("dotenv").config();

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.26",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
            viaIR: true,
        },
    },
    networks: {
        hardhat: {
            forking: {
                url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
                blockNumber: 22169491,
            },
            chainId: 1,
            initialBaseFeePerGas: 44500,
        },
        eth: {
            url: process.env.RPC_URL_ETH,
            accounts: [process.env.PRIVATE_KEY as string],
            timeout: 999999,
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_KEY,
    },
    gasReporter: {
        enabled: true,
        currency: "USD",
        gasPrice: 20,
        // gasPriceApi: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
        coinmarketcap: process.env.COINMKTCAP_API,
    },
};

export default config;
