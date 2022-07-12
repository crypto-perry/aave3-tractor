import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import { config as dotenvConfig } from "dotenv";
import { parseEther } from "ethers/lib/utils";
import "hardhat-gas-reporter";
import { HardhatUserConfig } from "hardhat/config";
import { resolve } from "path";
import "solidity-coverage";

import "./tasks/accounts";
import "./tasks/deploy";

dotenvConfig({ path: resolve(__dirname, "./.env") });

// Ensure that we have all the environment variables we need.
const rpcUrl: string | undefined = process.env.RPC_URL;
if (!rpcUrl) {
  throw new Error("Please set your RPC_URL in a .env file");
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      forking: {
        url: rpcUrl,
        blockNumber: parseInt(process.env.BLOCK_NUMBER_FORK || "30503660"),
      },
      accounts: {
        accountsBalance: parseEther("100000").toString(),
      },
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.13",
        settings: {
          metadata: {
            // Don't include metadata hash as it can change unexpectedly due to whitespace or import paths
            bytecodeHash: "none",
          },
          // Disable the optimizer when debugging: https://hardhat.org/hardhat-network/#solidity-optimizer-support
          optimizer: {
            enabled: false,
            runs: 800,
          },
        },
      },
      {
        version: "0.8.10",
      },
    ],
  },
  typechain: {
    outDir: "src/types",
    target: "ethers-v5",
  },
};

if (process.env.SECRET_KEY) {
  config.networks!["polygon"] = {
    url: rpcUrl,
    accounts: [process.env.SECRET_KEY!],
  };
}

export default config;
