// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract OlosVault is Ownable, ReentrancyGuard {
    constructor(address initialOwner) Ownable(initialOwner) {}

    // user => token => balance
    mapping(address => mapping(address => uint256)) public balances;

    // Optional: restrict which contracts can deduct for matches
    mapping(address => bool) public authorizedSpenders;

    event Deposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event Withdrawn(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event Deducted(address indexed user, address indexed token, uint256 amount);

    // -------------------------
    // ADMIN
    // -------------------------

    function setAuthorizedSpender(
        address spender,
        bool status
    ) external onlyOwner {
        authorizedSpenders[spender] = status;
    }

    // -------------------------
    // USER FUNCTIONS
    // -------------------------

    function deposit(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        balances[msg.sender][token] += amount;

        emit Deposited(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external nonReentrant {
        require(balances[msg.sender][token] >= amount, "Not enough");

        balances[msg.sender][token] -= amount;

        IERC20(token).transfer(msg.sender, amount);

        emit Withdrawn(msg.sender, token, amount);
    }

    // -------------------------
    // MATCH CONTRACT FUNCTION
    // -------------------------

    function deductForMatch(
        address user,
        address token,
        uint256 amount
    ) external nonReentrant {
        require(authorizedSpenders[msg.sender], "Not authorized");
        require(balances[user][token] >= amount, "Insufficient");

        balances[user][token] -= amount;

        emit Deducted(user, token, amount);
    }
}
