import axios from "axios";
import { BigNumber, constants } from "ethers";
import { formatUnits, parseEther, parseUnits } from "ethers/lib/utils";
import { ethers, network } from "hardhat";

import { IERC20 } from "../src/types";
import { Token } from "./constants";

export const numberToTokenAmount = (amount: number, token: Token) =>
  parseUnits(amount.toFixed(token.decimals), token.decimals);

export const tokenAmountToNumber = (amount: BigNumber, token: Token) => +formatUnits(amount, token.decimals);

export const mineBlocks = async (blocks: number = 1) => {
  for (let i = 0; i < blocks; i++) await network.provider.send("evm_mine");
};

export const fund = async (recipient: string, token: Token, amount: number) => {
  const erc20 = (await ethers.getContractAt("IERC20", token.address)) as IERC20;

  const signer = await impersonateAndFundWithETH(token.provider);
  await erc20.connect(signer).transfer(recipient, parseUnits(amount.toFixed(token.decimals), token.decimals));
};

async function impersonateAndFundWithETH(address: string) {
  const wallets = await ethers.getSigners();
  const funder = wallets[wallets.length - 1];
  const ForceSend = await ethers.getContractFactory("ForceSend");
  await ForceSend.connect(funder).deploy(address, { value: parseEther("1") });
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  return ethers.provider.getSigner(address);
}

export const queryOneInch = async (
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: BigNumber,
): Promise<string> => {
  const query =
    `https://api.1inch.exchange/v4.0/137/swap?` +
    `fromTokenAddress=${fromTokenAddress.toLowerCase()}` +
    `&toTokenAddress=${toTokenAddress.toLowerCase()}` +
    `&amount=${amount.toString()}` +
    `&fromAddress=${constants.AddressZero}` + // The actual address is the SC
    `&slippage=30` + // Does not matter as we enforce it separately
    `&disableEstimate=true` + // Don't check allowances and balances
    `&allowPartialFill=false`; // Don't allow partial fill
  //   query += `&protocols=${protocol}`
  //   query += `&mainRouteParts=1`
  //   query += `&parts=1`

  const response = await axios.get(query);

  if (response.status != 200) {
    throw new Error(JSON.stringify(response));
  }
  return response.data.tx.data;
};
