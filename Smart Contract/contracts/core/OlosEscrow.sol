// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/OlosTypes.sol";
import "../interfaces/IOlosEscrow.sol";

/**
 * @title OlosEscrow
 * @author OLOS
 * @notice Core escrow contract: staking, escrow, ECDSA-verified payout.
 *
 * Security:
 *  - ReentrancyGuard on every external state-changing function
 *  - ECDSA backend signature required on all result submissions
 *  - Replay protection: each result hash can only be used once
 *  - AccessControl: strict role separation
 *  - Pausable: emergency circuit breaker
 *  - MATCH_JOIN_TIMEOUT: prevents permanently locked funds
 *  - SafeERC20: safe token transfers throughout
 */
contract OlosEscrow is IOlosEscrow, ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ── Roles ────────────────────────────────────────────────────
    bytes32 public constant RESULT_SIGNER_ROLE  = keccak256("RESULT_SIGNER_ROLE");
    bytes32 public constant FEE_WITHDRAWER_ROLE = keccak256("FEE_WITHDRAWER_ROLE");
    bytes32 public constant PAUSER_ROLE         = keccak256("PAUSER_ROLE");

    // ── Constants ────────────────────────────────────────────────
    uint256 public constant PLATFORM_FEE_BPS  = 500;        // 5%
    uint256 public constant BPS_DENOMINATOR   = 10_000;
    uint256 public constant MATCH_JOIN_TIMEOUT = 10 minutes;
    uint256 public constant MIN_STAKE          = 1 * 10 ** 18; // 1 GVT

    // ── State ────────────────────────────────────────────────────
    IERC20 public immutable gvtToken;

    mapping(bytes32 => OlosTypes.Match) private _matches;
    mapping(bytes32 => bool)            private _usedResultSignatures;
    mapping(address => uint256)         private _playerNonce;

    uint256 public accruedFees;

    // ── Constructor ──────────────────────────────────────────────
    constructor(
        address gvtToken_,
        address admin_,
        address resultSigner_
    ) {
        require(gvtToken_     != address(0), "Escrow: zero token");
        require(admin_        != address(0), "Escrow: zero admin");
        require(resultSigner_ != address(0), "Escrow: zero signer");

        gvtToken = IERC20(gvtToken_);

        _grantRole(DEFAULT_ADMIN_ROLE,  admin_);
        _grantRole(RESULT_SIGNER_ROLE,  resultSigner_);
        _grantRole(FEE_WITHDRAWER_ROLE, admin_);
        _grantRole(PAUSER_ROLE,         admin_);
    }

    // ── Match Lifecycle ──────────────────────────────────────────

    /**
     * @notice Create a match and escrow the stake.
     * @param gameId      0=Snake 1=JumpingJack 2=Bounce 3=Tetris 4=Chess 5=Checkers
     * @param mode        SOLO or ONE_V_ONE
     * @param resultType  HIGH_SCORE or WIN_LOSS
     * @param stakeAmount GVT in wei. 0 = free practice.
     */
    function createMatch(
        uint8 gameId,
        OlosTypes.GameMode mode,
        OlosTypes.ResultType resultType,
        uint256 stakeAmount
    )
        external
        override
        nonReentrant
        whenNotPaused
        returns (bytes32 matchId)
    {
        require(
            stakeAmount == 0 || stakeAmount >= MIN_STAKE,
            "Escrow: stake below minimum"
        );

        matchId = _deriveMatchId(msg.sender, gameId, stakeAmount);
        require(_matches[matchId].createdAt == 0, "Escrow: matchId collision");

        _matches[matchId] = OlosTypes.Match({
            matchId:     matchId,
            gameId:      gameId,
            mode:        mode,
            resultType:  resultType,
            player1:     msg.sender,
            player2:     address(0),
            stakeAmount: stakeAmount,
            createdAt:   block.timestamp,
            startedAt:   0,
            completedAt: 0,
            status:      OlosTypes.MatchStatus.PENDING,
            winner:      address(0)
        });

        if (stakeAmount > 0) {
            gvtToken.safeTransferFrom(msg.sender, address(this), stakeAmount);
        }

        emit MatchCreated(matchId, msg.sender, gameId, stakeAmount, mode);
    }

    /**
     * @notice Player 2 joins a PENDING 1v1 match and deposits stake.
     */
    function joinMatch(bytes32 matchId)
        external
        override
        nonReentrant
        whenNotPaused
    {
        OlosTypes.Match storage m = _matches[matchId];

        require(m.createdAt != 0,                            "Escrow: match not found");
        require(m.status == OlosTypes.MatchStatus.PENDING,   "Escrow: match not joinable");
        require(m.mode   == OlosTypes.GameMode.ONE_V_ONE,    "Escrow: solo match");
        require(m.player2 == address(0),                     "Escrow: already full");
        require(msg.sender != m.player1,                     "Escrow: cannot join own match");
        require(
            block.timestamp <= m.createdAt + MATCH_JOIN_TIMEOUT,
            "Escrow: join window expired"
        );

        m.player2   = msg.sender;
        m.status    = OlosTypes.MatchStatus.ACTIVE;
        m.startedAt = block.timestamp;

        if (m.stakeAmount > 0) {
            gvtToken.safeTransferFrom(msg.sender, address(this), m.stakeAmount);
        }

        emit MatchJoined(matchId, msg.sender);
    }

    /**
     * @notice Submit a backend-signed result and release rewards.
     *         The backend ECDSA-signs the result hash — no unsigned result
     *         can ever trigger a payout.
     */
    function submitResult(
        OlosTypes.MatchResult calldata result,
        bytes calldata signature
    )
        external
        override
        nonReentrant
        whenNotPaused
    {
        OlosTypes.Match storage m = _matches[result.matchId];

        require(m.createdAt != 0, "Escrow: match not found");

        // Replay check FIRST — ensures a reused sig always gets the correct error
        bytes32 resultHash    = _hashMatchResult(result);
        bytes32 ethSignedHash = resultHash.toEthSignedMessageHash();

        require(!_usedResultSignatures[resultHash], "Escrow: result already used");
        _usedResultSignatures[resultHash] = true;

        address signer = ethSignedHash.recover(signature);
        require(hasRole(RESULT_SIGNER_ROLE, signer), "Escrow: invalid signer");

        // Status check after signature is verified
        require(
            m.status == OlosTypes.MatchStatus.ACTIVE ||
            (m.status == OlosTypes.MatchStatus.PENDING &&
             m.mode   == OlosTypes.GameMode.SOLO),
            "Escrow: match not active"
        );

        // ── Verify backend signature ────────────────────────────
        // ── Validate result data ────────────────────────────────
        _validateResult(m, result);

        // ── Update state ────────────────────────────────────────
        m.status      = OlosTypes.MatchStatus.COMPLETED;
        m.winner      = result.winner;
        m.completedAt = block.timestamp;

        emit MatchResultSubmitted(
            result.matchId,
            result.winner,
            result.player1Score,
            result.player2Score
        );

        // ── Distribute payout ───────────────────────────────────
        if (m.stakeAmount > 0) {
            _distributePayout(m);
        }
    }

    /**
     * @notice Cancel a PENDING match. Full stake refund to player1.
     *         Player1 can cancel anytime while PENDING.
     *         Anyone can cancel after MATCH_JOIN_TIMEOUT griefing protection.
     */
    function cancelMatch(bytes32 matchId)
        external
        override
        nonReentrant
    {
        OlosTypes.Match storage m = _matches[matchId];

        require(m.createdAt != 0,                          "Escrow: match not found");
        require(m.status == OlosTypes.MatchStatus.PENDING, "Escrow: only pending matches");

        bool isPlayer1   = msg.sender == m.player1;
        bool joinExpired = block.timestamp > m.createdAt + MATCH_JOIN_TIMEOUT;

        require(isPlayer1 || joinExpired, "Escrow: not authorised to cancel");

        m.status = OlosTypes.MatchStatus.CANCELLED;

        if (m.stakeAmount > 0) {
            gvtToken.safeTransfer(m.player1, m.stakeAmount);
        }

        emit MatchCancelled(matchId, msg.sender);
    }

    // ── Admin ────────────────────────────────────────────────────

    /// @notice Withdraw accumulated platform fees to treasury.
    function withdrawFees(address to)
        external
        nonReentrant
        onlyRole(FEE_WITHDRAWER_ROLE)
    {
        require(to != address(0), "Escrow: zero address");
        uint256 amount = accruedFees;
        require(amount > 0, "Escrow: no fees");

        accruedFees = 0;
        gvtToken.safeTransfer(to, amount);

        emit PlatformFeeWithdrawn(to, amount);
    }

    function pause()   external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ── View ─────────────────────────────────────────────────────

    function getMatch(bytes32 matchId)
        external view override
        returns (OlosTypes.Match memory)
    {
        return _matches[matchId];
    }

    /// @notice Returns the hash the backend must sign for a result.
    function getResultHash(OlosTypes.MatchResult calldata result)
        external pure returns (bytes32)
    {
        return _hashMatchResult(result);
    }

    // ── Internal ─────────────────────────────────────────────────

    function _distributePayout(OlosTypes.Match storage m) internal {
        uint256 totalPot = m.stakeAmount * _playersInMatch(m);
        uint256 fee      = (totalPot * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout   = totalPot - fee;

        accruedFees += fee;

        address payoutTo = (m.winner != address(0)) ? m.winner : m.player1;
        gvtToken.safeTransfer(payoutTo, payout);

        emit RewardDistributed(m.matchId, payoutTo, payout, fee);
    }

    function _validateResult(
        OlosTypes.Match storage m,
        OlosTypes.MatchResult calldata result
    ) internal view {
        require(result.duration > 0, "Escrow: zero duration");
        if (m.mode == OlosTypes.GameMode.ONE_V_ONE) {
            require(
                result.winner == m.player1 || result.winner == m.player2,
                "Escrow: winner not a participant"
            );
        }
    }

    function _hashMatchResult(OlosTypes.MatchResult calldata result)
        internal pure returns (bytes32)
    {
        return keccak256(abi.encode(
            result.matchId,
            result.winner,
            result.player1Score,
            result.player2Score,
            result.duration
        ));
    }

    function _deriveMatchId(
        address player,
        uint8 gameId,
        uint256 stakeAmount
    ) internal returns (bytes32) {
        uint256 nonce = _playerNonce[player]++;
        return keccak256(abi.encodePacked(
            player, gameId, stakeAmount, nonce, block.timestamp
        ));
    }

    function _playersInMatch(OlosTypes.Match storage m)
        internal view returns (uint256)
    {
        return (m.mode == OlosTypes.GameMode.ONE_V_ONE && m.player2 != address(0))
            ? 2 : 1;
    }
}