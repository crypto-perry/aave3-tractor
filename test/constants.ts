export type Token = {
  address: string;
  symbol: string;
  decimals: number;
  provider: string;
};

export const USDC: Token = {
  address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  symbol: "USDC",
  decimals: 6,
  provider: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
};

export const USDT: Token = {
  address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  symbol: "USDT",
  decimals: 6,
  provider: "0x0D0707963952f2fBA59dD06f2b425ace40b492Fe",
};

export const DAI: Token = {
  address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  symbol: "DAI",
  decimals: 18,
  provider: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
};
