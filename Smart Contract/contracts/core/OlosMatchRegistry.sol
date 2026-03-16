// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../libraries/OlosTypes.sol";

/**
 * @title OlosMatchRegistry
 * @author OLOS
 * @notice On-chain match history and player stats for leaderboard.
 *         Only the Escrow contract (RECORDER_ROLE) can write here.
 */
contract OlosMatchRegistry is AccessControl {
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    struct PlayerStats {
        uint256 totalMatches;
        uint256 wins;
        uint256 losses;
        uint256 totalStaked;    // Cumulative GVT staked
        uint256 totalEarned;    // Cumulative GVT won
        uint256 highScore;      // All-time high across any game
        uint256 lastPlayedAt;
    }

    struct MatchRecord {
        bytes32 matchId;
        uint8   gameId;
        address player1;
        address player2;
        address winner;
        uint256 stakeAmount;
        uint256 player1Score;
        uint256 player2Score;
        uint256 duration;
        uint256 completedAt;
    }

    mapping(bytes32 => MatchRecord)   private _records;
    mapping(address => PlayerStats)   private _stats;
    mapping(address => bytes32[])     private _playerMatches;

    bytes32[] public allMatchIds;

    event MatchRecorded(bytes32 indexed matchId, address indexed winner, uint8 gameId);
    event StatsUpdated(address indexed player);

    constructor(address admin_) {
        require(admin_ != address(0), "Registry: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    // ── Write (RECORDER_ROLE only) ───────────────────────────────

    function recordMatch(
        bytes32 matchId,
        uint8   gameId,
        address player1,
        address player2,
        address winner,
        uint256 stakeAmount,
        uint256 player1Score,
        uint256 player2Score,
        uint256 duration,
        uint256 winnerPayout
    ) external onlyRole(RECORDER_ROLE) {
        require(_records[matchId].completedAt == 0, "Registry: already recorded");

        _records[matchId] = MatchRecord({
            matchId:      matchId,
            gameId:       gameId,
            player1:      player1,
            player2:      player2,
            winner:       winner,
            stakeAmount:  stakeAmount,
            player1Score: player1Score,
            player2Score: player2Score,
            duration:     duration,
            completedAt:  block.timestamp
        });

        allMatchIds.push(matchId);
        _playerMatches[player1].push(matchId);
        if (player2 != address(0)) {
            _playerMatches[player2].push(matchId);
        }

        _updateStats(player1, player2, winner, stakeAmount,
                     player1Score, player2Score, winnerPayout);

        emit MatchRecorded(matchId, winner, gameId);
    }

    // ── View ─────────────────────────────────────────────────────

    function getMatchRecord(bytes32 matchId)
        external view returns (MatchRecord memory)
    {
        return _records[matchId];
    }

    function getPlayerStats(address player)
        external view returns (PlayerStats memory)
    {
        return _stats[player];
    }

    function getPlayerMatchHistory(address player)
        external view returns (bytes32[] memory)
    {
        return _playerMatches[player];
    }

    function getPlayerMatchHistoryPaginated(
        address player,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory) {
        bytes32[] storage all = _playerMatches[player];
        uint256 total = all.length;
        if (offset >= total) return new bytes32[](0);
        uint256 end  = offset + limit > total ? total : offset + limit;
        uint256 size = end - offset;
        bytes32[] memory page = new bytes32[](size);
        for (uint256 i = 0; i < size; i++) {
            page[i] = all[offset + i];
        }
        return page;
    }

    function totalMatches() external view returns (uint256) {
        return allMatchIds.length;
    }

    // ── Internal ─────────────────────────────────────────────────

    function _updateStats(
        address player1, address player2, address winner,
        uint256 stakeAmount, uint256 p1Score, uint256 p2Score,
        uint256 winnerPayout
    ) internal {
        _stats[player1].totalMatches++;
        _stats[player1].lastPlayedAt = block.timestamp;
        _stats[player1].totalStaked += stakeAmount;
        if (p1Score > _stats[player1].highScore) {
            _stats[player1].highScore = p1Score;
        }

        if (player2 != address(0)) {
            _stats[player2].totalMatches++;
            _stats[player2].lastPlayedAt = block.timestamp;
            _stats[player2].totalStaked += stakeAmount;
            if (p2Score > _stats[player2].highScore) {
                _stats[player2].highScore = p2Score;
            }
        }

        if (winner != address(0)) {
            _stats[winner].wins++;
            _stats[winner].totalEarned += winnerPayout;
            if (player2 != address(0)) {
                address loser = (winner == player1) ? player2 : player1;
                _stats[loser].losses++;
            }
        }

        emit StatsUpdated(player1);
        if (player2 != address(0)) emit StatsUpdated(player2);
    }
}