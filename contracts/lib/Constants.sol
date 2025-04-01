// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "../interfaces/IWhitelistRegistry.sol";

// ===================== Contract Addresses ======================
address constant H420 = 0xaa26754dD0C8310cB70F3B66DAeAb52c8cFf3c30;
address constant HLX = 0x2614f29C39dE46468A921Fd0b41fdd99A01f2EDf;
address constant TITANX = 0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1;
address constant WETH9 = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
address constant E280 = 0x058E7b30200d001130232e8fBfDF900590E0bAA9;

address constant TITANX_HLX_POOL = 0x2C83C54C5612BfD62a78124D4A0eA001278a689c;
address constant UNISWAP_V2_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
address constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;

uint24 constant POOL_FEE_1PERCENT = 10000;
uint16 constant BPS_BASE = 100_00;

IWhitelistRegistry constant WL_REGISTRY = IWhitelistRegistry(0x9634E1Cdc25106B892a8cCbA014441E8A1E842a1);