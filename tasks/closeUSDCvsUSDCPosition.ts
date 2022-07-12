import { ethers } from "hardhat";

import { AaveTractor } from "../src/types";
import { AaveTractorAddress, USDC } from "../test/constants";

const closeUSDCvsUSDCPosition = async () => {
  const supply = USDC;
  const borrow = USDC;

  const aaveTractor: AaveTractor = await ethers.getContractAt("AaveTractor", AaveTractorAddress);

  await aaveTractor.closePosition(supply.address, 0, borrow.address, 0, "0x");
};

closeUSDCvsUSDCPosition().catch(console.log);
