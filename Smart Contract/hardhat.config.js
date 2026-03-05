require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ignition");

require("dotenv").config();

module.exports = {
  solidity: "0.8.28",

  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },

    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY]
        : [],
    },
  },
};