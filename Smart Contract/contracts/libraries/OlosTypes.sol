// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OlosTypes
 * @notice Shared data structures across OLOS contracts.
 */
library OlosTypes {
    enum MatchStatus {
        PENDING,    // Created, waiting for player2
        ACTIVE,     // Both players joined, game in progress
        COMPLETED,  // Result submitted and verified
        CANCELLED,  // Cancelled before start (full refund)
        DISPUTED    // Result under review (after MVP)
    }

    enum GameMode {
        SOLO,       // Single player, no opponent
        ONE_V_ONE   // Two players, one winner
    }

    enum ResultType {
        HIGH_SCORE, // Snake, Tetris, Jumping Jack, Bounce
        WIN_LOSS    // Chess, Checkers
    }

    struct Match {
        bytes32     matchId;
        uint8       gameId;         // 0=Snake 1=JumpingJack 2=Bounce 3=Tetris 4=Chess 5=Checkers
        GameMode    mode;
        ResultType  resultType;
        address     player1;
        address     player2;        // address(0) if SOLO or not yet joined
        uint256     stakeAmount;    // Per-player stake in GVT (wei)
        uint256     createdAt;
        uint256     startedAt;
        uint256     completedAt;
        MatchStatus status;
        address     winner;         // address(0) until COMPLETED
    }

    struct MatchResult {
        bytes32 matchId;
        address winner;         // address(0) for SOLO
        uint256 player1Score;
        uint256 player2Score;
        uint256 duration;       // seconds
    }
}