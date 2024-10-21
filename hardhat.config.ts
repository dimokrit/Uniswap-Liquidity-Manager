import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-uniswap";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.7.6", // версия для контрактов, требующих 0.8.x
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
};

export default config;
