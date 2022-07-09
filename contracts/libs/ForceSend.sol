// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.4;

contract ForceSend {
    constructor(address payable to) payable {
        selfdestruct(to);
    }
}
