// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title GVTToken
 * @author OLOS
 * @notice OLOS Gaming Value Token (GVT).
 *         we are working on MVP: test-mintable by MINTER_ROLE for beta distribution.
 */
contract GVTToken is ERC20, ERC20Burnable, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Hard cap: 1 billion GVT
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    event TokensMinted(address indexed to, uint256 amount);

    constructor(address admin) ERC20("OLOS Gaming Value Token", "GVT") {
        require(admin != address(0), "GVT: zero admin address");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    /**
     * @notice Mint GVT tokens — beta or test distribution.
     * @param to     Recipient
     * @param amount Amount in wei (18 decimals)
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "GVT: mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "GVT: exceeds max supply");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    /// @dev Block transfers while paused; minting is still allowed for admin ops.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0)) {
            require(!paused(), "GVT: token transfers paused");
        }
        super._update(from, to, value);
    }
}