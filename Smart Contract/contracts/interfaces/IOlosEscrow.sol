// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/OlosTypes.sol";

interface IOlosEscrow {
    event MatchCreated(
        bytes32 indexed matchId,
        address indexed player1,
        uint8   gameId,
        uint256 stakeAmount,
        OlosTypes.GameMode mode
    );
    event MatchJoined(bytes32 indexed matchId, address indexed player2);
    event MatchResultSubmitted(
        bytes32 indexed matchId,
        address indexed winner,
        uint256 player1Score,
        uint256 player2Score
    );
    event RewardDistributed(
        bytes32 indexed matchId,
        address indexed winner,
        uint256 winnerPayout,
        uint256 platformFee
    );
    event MatchCancelled(bytes32 indexed matchId, address indexed cancelledBy);
    event PlatformFeeWithdrawn(address indexed to, uint256 amount);

    function createMatch(
        uint8 gameId,
        OlosTypes.GameMode mode,
        OlosTypes.ResultType resultType,
        uint256 stakeAmount
    ) external returns (bytes32 matchId);

    function joinMatch(bytes32 matchId) external;

    function submitResult(
        OlosTypes.MatchResult calldata result,
        bytes calldata signature
    ) external;

    function cancelMatch(bytes32 matchId) external;

    function getMatch(bytes32 matchId)
        external view returns (OlosTypes.Match memory);
}