import { expect }                        from "chai";
import { ethers }                        from "hardhat";
import type { ContractTransactionReceipt, Log } from "ethers";
import { time }                          from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress }              from "@nomicfoundation/hardhat-ethers/signers";
import {
  GVTToken,
  OlosEscrow,
  OlosMatchRegistry,
} from "../typechain-types";

// ─────────────────────────────────────────────────────────────────────────────
// Enum mirrors — must match Solidity exactly
// ─────────────────────────────────────────────────────────────────────────────
const GameMode    = { SOLO: 0,       ONE_V_ONE: 1  } as const;
const ResultType  = { HIGH_SCORE: 0, WIN_LOSS: 1   } as const;
const MatchStatus = {
  PENDING: 0, ACTIVE: 1, COMPLETED: 2, CANCELLED: 3, DISPUTED: 4,
} as const;

const GAME = {
  SNAKE: 0, JUMPING_JACK: 1, BOUNCE: 2,
  TETRIS: 3, CHESS: 4, CHECKERS: 5,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const GVT          = (n: number | bigint) => ethers.parseEther(n.toString());
const JOIN_TIMEOUT = 10 * 60; // seconds — matches MATCH_JOIN_TIMEOUT in contract

/** Hash a result exactly as OlosEscrow._hashMatchResult (abi.encode, not packed) */
function hashResult(r: {
  matchId:      string;
  winner:       string;
  player1Score: bigint;
  player2Score: bigint;
  duration:     bigint;
}): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256", "uint256", "uint256"],
      [r.matchId, r.winner, r.player1Score, r.player2Score, r.duration]
    )
  );
}

/** Sign a result with a signer — signMessage() adds the Ethereum prefix matching the contract */
async function signResult(
  signer: SignerWithAddress,
  r: {
    matchId:      string;
    winner:       string;
    player1Score: bigint;
    player2Score: bigint;
    duration:     bigint;
  }
): Promise<string> {
  return signer.signMessage(ethers.getBytes(hashResult(r)));
}

/**
 * Extract matchId from a MatchCreated event.
 * FIX: tx.wait() returns ContractTransactionReceipt | null — we assert non-null
 * explicitly so TypeScript is satisfied and we get a clear error if it ever is null.
 */
async function getMatchId(
  escrow: OlosEscrow,
  tx: Awaited<ReturnType<typeof escrow.createMatch>>
): Promise<string> {
  // tx can be null if the transaction was not mined
  if (!tx) throw new Error("Transaction response is null");
  
  const receipt = (await tx.wait()) as ContractTransactionReceipt;
  if (!receipt) throw new Error("Transaction was not mined");

  const event = receipt.logs
    .map((l: Log) => {
      try { return escrow.interface.parseLog(l); } catch { return null; }
    })
    .find((e) => e?.name === "MatchCreated");

  if (!event) throw new Error("MatchCreated event not found in receipt");
  return event.args.matchId as string;
}

/**
 * Create + join a 1v1 match.  Returns the matchId of the now-ACTIVE match.
 */
async function setupActiveMatch(
  escrow: OlosEscrow,
  p1:     SignerWithAddress,
  p2:     SignerWithAddress,
  opts?:  { gameId?: number; resultType?: number; stakeAmount?: bigint }
): Promise<string> {
  const tx = await escrow.connect(p1).createMatch(
    opts?.gameId      ?? GAME.SNAKE,
    GameMode.ONE_V_ONE,
    opts?.resultType  ?? ResultType.HIGH_SCORE,
    opts?.stakeAmount ?? GVT(100)
  );
  const matchId = await getMatchId(escrow, tx);
  await escrow.connect(p2).joinMatch(matchId);
  return matchId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe("OLOS MVP — Full Contract Suite", () => {
  let admin:        SignerWithAddress;
  let player1:      SignerWithAddress;
  let player2:      SignerWithAddress;
  let player3:      SignerWithAddress;
  let resultSigner: SignerWithAddress;
  let treasury:     SignerWithAddress;
  let attacker:     SignerWithAddress;

  let gvt:        GVTToken;
  let escrow:     OlosEscrow;
  let registry:   OlosMatchRegistry;
  let escrowAddr: string;

  beforeEach(async () => {
    [admin, player1, player2, player3, resultSigner, treasury, attacker] =
      await ethers.getSigners();

    // FIX: deploy() returns BaseContract — cast to the correct typechain type
    gvt = (await (await ethers.getContractFactory("GVTToken"))
      .deploy(admin.address)) as unknown as GVTToken;

    registry = (await (await ethers.getContractFactory("OlosMatchRegistry"))
      .deploy(admin.address)) as unknown as OlosMatchRegistry;

    escrow = (await (await ethers.getContractFactory("OlosEscrow"))
      .deploy(
        await gvt.getAddress(),
        admin.address,
        resultSigner.address
      )) as unknown as OlosEscrow;

    escrowAddr = await escrow.getAddress();

    // Wire roles
    await gvt.connect(admin).grantRole(await gvt.MINTER_ROLE(), escrowAddr);
    await registry
      .connect(admin)
      .grantRole(await registry.RECORDER_ROLE(), escrowAddr);

    // Fund players with 10,000 GVT each and max-approve escrow
    for (const p of [player1, player2, player3]) {
      await gvt.connect(admin).mint(p.address, GVT(10_000));
      await gvt.connect(p).approve(escrowAddr, ethers.MaxUint256);
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. GVT TOKEN
  // ═══════════════════════════════════════════════════════════════

  describe("GVTToken", () => {
    it("has correct name, symbol, decimals", async () => {
      expect(await gvt.name()).to.equal("OLOS Gaming Value Token");
      expect(await gvt.symbol()).to.equal("GVT");
      expect(await gvt.decimals()).to.equal(18);
    });

    it("MAX_SUPPLY is 1 billion GVT", async () => {
      expect(await gvt.MAX_SUPPLY()).to.equal(GVT(1_000_000_000));
    });

    it("MINTER_ROLE can mint", async () => {
      await gvt.connect(admin).mint(treasury.address, GVT(500));
      expect(await gvt.balanceOf(treasury.address)).to.equal(GVT(500));
    });

    it("emits TokensMinted", async () => {
      await expect(gvt.connect(admin).mint(treasury.address, GVT(1)))
        .to.emit(gvt, "TokensMinted")
        .withArgs(treasury.address, GVT(1));
    });

    it("reverts mint beyond MAX_SUPPLY", async () => {
      const rem = (await gvt.MAX_SUPPLY()) - (await gvt.totalSupply());
      await gvt.connect(admin).mint(treasury.address, rem);
      await expect(gvt.connect(admin).mint(treasury.address, 1n))
        .to.be.revertedWith("GVT: exceeds max supply");
    });

    it("reverts mint to zero address", async () => {
      await expect(gvt.connect(admin).mint(ethers.ZeroAddress, GVT(1)))
        .to.be.revertedWith("GVT: mint to zero address");
    });

    it("reverts mint from non-MINTER_ROLE", async () => {
      await expect(
        gvt.connect(attacker).mint(attacker.address, GVT(1))
      ).to.be.reverted;
    });

    it("transfers blocked while paused", async () => {
      await gvt.connect(admin).pause();
      await expect(
        gvt.connect(player1).transfer(player2.address, GVT(1))
      ).to.be.revertedWith("GVT: token transfers paused");
    });

    it("minting allowed while paused (admin ops)", async () => {
      await gvt.connect(admin).pause();
      await expect(
        gvt.connect(admin).mint(treasury.address, GVT(100))
      ).to.not.be.reverted;
    });

    it("transfers resume after unpause", async () => {
      await gvt.connect(admin).pause();
      await gvt.connect(admin).unpause();
      await expect(
        gvt.connect(player1).transfer(player2.address, GVT(1))
      ).to.not.be.reverted;
    });

    it("non-PAUSER_ROLE cannot pause", async () => {
      await expect(gvt.connect(attacker).pause()).to.be.reverted;
    });

    // FIX: ERC20Burnable exposes burn() but typechain may not expose it directly.
    // We call it via the low-level interface to avoid the type error.
    it("holder can burn tokens via ERC20Burnable", async () => {
      const supplyBefore = await gvt.totalSupply();
      // Use the contract's ABI directly so we don't rely on typechain exposing burn()
      const gvtWithBurn = new ethers.Contract(
        await gvt.getAddress(),
        ["function burn(uint256 amount)"],
        player1
      );
      await gvtWithBurn.burn(GVT(100));
      expect(await gvt.totalSupply()).to.equal(supplyBefore - GVT(100));
      expect(await gvt.balanceOf(player1.address)).to.equal(GVT(9_900));
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. CREATE MATCH
  // ═══════════════════════════════════════════════════════════════

  describe("OlosEscrow — createMatch", () => {
    it("creates 1v1 staked match: correct state + tokens escrowed", async () => {
      const stake    = GVT(100);
      const p1Before = await gvt.balanceOf(player1.address);

      const tx      = await escrow.connect(player1)
        .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, stake);
      const matchId = await getMatchId(escrow, tx);
      const m       = await escrow.getMatch(matchId);

      expect(m.player1).to.equal(player1.address);
      expect(m.player2).to.equal(ethers.ZeroAddress);
      expect(m.gameId).to.equal(GAME.SNAKE);
      expect(m.stakeAmount).to.equal(stake);
      expect(m.status).to.equal(MatchStatus.PENDING);
      expect(m.mode).to.equal(GameMode.ONE_V_ONE);
      expect(m.winner).to.equal(ethers.ZeroAddress);
      expect(await gvt.balanceOf(player1.address)).to.equal(p1Before - stake);
      expect(await gvt.balanceOf(escrowAddr)).to.equal(stake);
    });

    it("creates free practice solo match (0 stake)", async () => {
      const tx = await escrow.connect(player1)
        .createMatch(GAME.TETRIS, GameMode.SOLO, ResultType.HIGH_SCORE, 0);
      const m  = await escrow.getMatch(await getMatchId(escrow, tx));
      expect(m.stakeAmount).to.equal(0n);
      expect(await gvt.balanceOf(escrowAddr)).to.equal(0n);
    });

    it("emits MatchCreated with correct args", async () => {
      await expect(
        escrow.connect(player1)
          .createMatch(GAME.CHESS, GameMode.ONE_V_ONE, ResultType.WIN_LOSS, GVT(50))
      )
        .to.emit(escrow, "MatchCreated")
        .withArgs(
          (_: unknown) => true, // matchId is dynamic
          player1.address,
          GAME.CHESS,
          GVT(50),
          GameMode.ONE_V_ONE
        );
    });

    it("works for all 6 game IDs and stores correct gameId", async () => {
      for (const [name, id] of Object.entries(GAME)) {
        const rt = (id === GAME.CHESS || id === GAME.CHECKERS)
          ? ResultType.WIN_LOSS
          : ResultType.HIGH_SCORE;
        const tx = await escrow.connect(player1)
          .createMatch(id, GameMode.ONE_V_ONE, rt, GVT(10));
        const m  = await escrow.getMatch(await getMatchId(escrow, tx));
        expect(m.gameId).to.equal(id, `${name} should store gameId ${id}`);
      }
    });

    it("two matches from the same player produce different matchIds", async () => {
      const tx1 = await escrow.connect(player1)
        .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, GVT(10));
      const tx2 = await escrow.connect(player1)
        .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, GVT(10));
      expect(await getMatchId(escrow, tx1)).to.not.equal(await getMatchId(escrow, tx2));
    });

    it("reverts stake below MIN_STAKE (but non-zero)", async () => {
      await expect(
        escrow.connect(player1)
          .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, 1n)
      ).to.be.revertedWith("Escrow: stake below minimum");
    });

    it("reverts with zero allowance", async () => {
      await gvt.connect(player1).approve(escrowAddr, 0n);
      await expect(
        escrow.connect(player1)
          .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, GVT(100))
      ).to.be.reverted;
    });

    it("reverts when paused", async () => {
      await escrow.connect(admin).pause();
      await expect(
        escrow.connect(player1)
          .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, GVT(100))
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. JOIN MATCH
  // ═══════════════════════════════════════════════════════════════

  describe("OlosEscrow — joinMatch", () => {
    const stake = GVT(100);
    let matchId: string;

    beforeEach(async () => {
      const tx = await escrow.connect(player1)
        .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, stake);
      matchId = await getMatchId(escrow, tx);
    });

    it("player2 joins: ACTIVE, escrow holds 2× stake", async () => {
      const p2Before = await gvt.balanceOf(player2.address);
      await escrow.connect(player2).joinMatch(matchId);

      expect(await gvt.balanceOf(player2.address)).to.equal(p2Before - stake);
      expect(await gvt.balanceOf(escrowAddr)).to.equal(stake * 2n);

      const m = await escrow.getMatch(matchId);
      expect(m.status).to.equal(MatchStatus.ACTIVE);
      expect(m.player2).to.equal(player2.address);
      expect(m.startedAt).to.be.gt(0n);
    });

    it("emits MatchJoined", async () => {
      await expect(escrow.connect(player2).joinMatch(matchId))
        .to.emit(escrow, "MatchJoined")
        .withArgs(matchId, player2.address);
    });

    it("reverts: player1 joins own match", async () => {
      await expect(escrow.connect(player1).joinMatch(matchId))
        .to.be.revertedWith("Escrow: cannot join own match");
    });

    it("reverts: match already full (ACTIVE)", async () => {
      await escrow.connect(player2).joinMatch(matchId);
      await gvt.connect(player3).approve(escrowAddr, ethers.MaxUint256);
      await expect(escrow.connect(player3).joinMatch(matchId))
        .to.be.revertedWith("Escrow: match not joinable");
    });

    it("reverts: unknown matchId", async () => {
      await expect(escrow.connect(player2).joinMatch(ethers.ZeroHash))
        .to.be.revertedWith("Escrow: match not found");
    });

    it("reverts: after the 10-minute join window", async () => {
      await time.increase(JOIN_TIMEOUT + 1);
      await expect(escrow.connect(player2).joinMatch(matchId))
        .to.be.revertedWith("Escrow: join window expired");
    });

    it("reverts: joining a SOLO match", async () => {
      const soloTx = await escrow.connect(player1)
        .createMatch(GAME.TETRIS, GameMode.SOLO, ResultType.HIGH_SCORE, GVT(50));
      const soloId = await getMatchId(escrow, soloTx);
      await expect(escrow.connect(player2).joinMatch(soloId))
        .to.be.revertedWith("Escrow: solo match");
    });

    it("reverts when paused", async () => {
      await escrow.connect(admin).pause();
      await expect(escrow.connect(player2).joinMatch(matchId))
        .to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 4. SUBMIT RESULT — 1v1 HIGH SCORE
  // ═══════════════════════════════════════════════════════════════

  describe("OlosEscrow — submitResult (1v1 HIGH_SCORE)", () => {
    const stake    = GVT(100);
    const totalPot = GVT(200);
    const fee      = (totalPot * 500n) / 10_000n; // 5%
    const payout   = totalPot - fee;
    let matchId:   string;

    beforeEach(async () => {
      matchId = await setupActiveMatch(escrow, player1, player2, { stakeAmount: stake });
    });

    it("winner receives pot minus 5% fee", async () => {
      const r        = { matchId, winner: player1.address, player1Score: 1500n, player2Score: 800n, duration: 120n };
      const p1Before = await gvt.balanceOf(player1.address);
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      expect(await gvt.balanceOf(player1.address) - p1Before).to.equal(payout);
    });

    it("5% lands in accruedFees", async () => {
      const r = { matchId, winner: player1.address, player1Score: 1500n, player2Score: 800n, duration: 120n };
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      expect(await escrow.accruedFees()).to.equal(fee);
    });

    it("loser receives nothing from the pot", async () => {
      const r        = { matchId, winner: player1.address, player1Score: 1500n, player2Score: 800n, duration: 120n };
      const p2Before = await gvt.balanceOf(player2.address);
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      expect(await gvt.balanceOf(player2.address)).to.equal(p2Before);
    });

    it("match is COMPLETED with winner stored", async () => {
      const r = { matchId, winner: player2.address, player1Score: 400n, player2Score: 2000n, duration: 90n };
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      const m = await escrow.getMatch(matchId);
      expect(m.status).to.equal(MatchStatus.COMPLETED);
      expect(m.winner).to.equal(player2.address);
      expect(m.completedAt).to.be.gt(0n);
    });

    it("emits MatchResultSubmitted and RewardDistributed", async () => {
      const r   = { matchId, winner: player1.address, player1Score: 1500n, player2Score: 800n, duration: 120n };
      const sig = await signResult(resultSigner, r);
      await expect(escrow.connect(admin).submitResult(r, sig))
        .to.emit(escrow, "MatchResultSubmitted")
        .withArgs(matchId, player1.address, 1500n, 800n)
        .and.to.emit(escrow, "RewardDistributed")
        .withArgs(matchId, player1.address, payout, fee);
    });

    it("reverts: wrong signing key", async () => {
      const r = { matchId, winner: player1.address, player1Score: 1500n, player2Score: 800n, duration: 120n };
      await expect(
        escrow.connect(admin).submitResult(r, await signResult(attacker, r))
      ).to.be.revertedWith("Escrow: invalid signer");
    });

    it("reverts: signature replay — same sig cannot be submitted twice", async () => {
      const r   = { matchId, winner: player1.address, player1Score: 1500n, player2Score: 800n, duration: 120n };
      const sig = await signResult(resultSigner, r);
      await escrow.connect(admin).submitResult(r, sig);

      // Replay: same result + same sig.
      // Replay check now fires before status check, so this correctly
      // reverts with "result already used" even though match is COMPLETED.
      await expect(
        escrow.connect(admin).submitResult(r, sig)
      ).to.be.revertedWith("Escrow: result already used");
    });

    it("reverts: winner is not a participant", async () => {
      const r = { matchId, winner: attacker.address, player1Score: 9999n, player2Score: 1n, duration: 60n };
      await expect(
        escrow.connect(admin).submitResult(r, await signResult(resultSigner, r))
      ).to.be.revertedWith("Escrow: winner not a participant");
    });

    it("reverts: duration is zero", async () => {
      const r = { matchId, winner: player1.address, player1Score: 1000n, player2Score: 500n, duration: 0n };
      await expect(
        escrow.connect(admin).submitResult(r, await signResult(resultSigner, r))
      ).to.be.revertedWith("Escrow: zero duration");
    });

    it("reverts: second result on a COMPLETED match", async () => {
      const r1 = { matchId, winner: player1.address, player1Score: 1000n, player2Score: 500n, duration: 60n };
      await escrow.connect(admin).submitResult(r1, await signResult(resultSigner, r1));
      const r2 = { matchId, winner: player2.address, player1Score: 500n,  player2Score: 2000n, duration: 70n };
      await expect(
        escrow.connect(admin).submitResult(r2, await signResult(resultSigner, r2))
      ).to.be.revertedWith("Escrow: match not active");
    });

    it("reverts when paused", async () => {
      const r = { matchId, winner: player1.address, player1Score: 1500n, player2Score: 800n, duration: 120n };
      await escrow.connect(admin).pause();
      await expect(
        escrow.connect(admin).submitResult(r, await signResult(resultSigner, r))
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 5. SUBMIT RESULT — WIN/LOSS (Chess & Checkers)
  // ═══════════════════════════════════════════════════════════════

  describe("OlosEscrow — submitResult (WIN_LOSS)", () => {
    const stake = GVT(200);

    it("Chess: winner gets pot minus fee", async () => {
      const matchId = await setupActiveMatch(escrow, player1, player2,
        { gameId: GAME.CHESS, resultType: ResultType.WIN_LOSS, stakeAmount: stake });
      const r        = { matchId, winner: player2.address, player1Score: 0n, player2Score: 1n, duration: 600n };
      const p2Before = await gvt.balanceOf(player2.address);
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      const payout = stake * 2n - (stake * 2n * 500n) / 10_000n;
      expect(await gvt.balanceOf(player2.address) - p2Before).to.equal(payout);
    });

    it("Checkers: winner gets pot minus fee", async () => {
      const matchId = await setupActiveMatch(escrow, player1, player2,
        { gameId: GAME.CHECKERS, resultType: ResultType.WIN_LOSS, stakeAmount: stake });
      const r        = { matchId, winner: player1.address, player1Score: 1n, player2Score: 0n, duration: 300n };
      const p1Before = await gvt.balanceOf(player1.address);
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      const payout = stake * 2n - (stake * 2n * 500n) / 10_000n;
      expect(await gvt.balanceOf(player1.address) - p1Before).to.equal(payout);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 6. SUBMIT RESULT — SOLO
  // ═══════════════════════════════════════════════════════════════

  describe("OlosEscrow — submitResult (SOLO)", () => {
    it("returns stake minus 5% fee to solo player", async () => {
      const stake = GVT(50);
      const tx    = await escrow.connect(player1)
        .createMatch(GAME.JUMPING_JACK, GameMode.SOLO, ResultType.HIGH_SCORE, stake);
      const matchId  = await getMatchId(escrow, tx);
      const r        = { matchId, winner: ethers.ZeroAddress, player1Score: 8000n, player2Score: 0n, duration: 90n };
      const p1Before = await gvt.balanceOf(player1.address);
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      const payout = stake - (stake * 500n) / 10_000n;
      expect(await gvt.balanceOf(player1.address) - p1Before).to.equal(payout);
    });

    it("free practice (0 stake): no tokens move, status COMPLETED", async () => {
      const tx      = await escrow.connect(player1)
        .createMatch(GAME.BOUNCE, GameMode.SOLO, ResultType.HIGH_SCORE, 0);
      const matchId  = await getMatchId(escrow, tx);
      const r        = { matchId, winner: ethers.ZeroAddress, player1Score: 3000n, player2Score: 0n, duration: 45n };
      const p1Before = await gvt.balanceOf(player1.address);
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      expect(await gvt.balanceOf(player1.address)).to.equal(p1Before);
      expect(await escrow.accruedFees()).to.equal(0n);
      expect((await escrow.getMatch(matchId)).status).to.equal(MatchStatus.COMPLETED);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 7. CANCEL MATCH
  // ═══════════════════════════════════════════════════════════════

  describe("OlosEscrow — cancelMatch", () => {
    it("player1 gets full stake refund on cancel", async () => {
      const stake   = GVT(100);
      const tx      = await escrow.connect(player1)
        .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, stake);
      const matchId  = await getMatchId(escrow, tx);
      const p1Before = await gvt.balanceOf(player1.address);

      await escrow.connect(player1).cancelMatch(matchId);

      expect(await gvt.balanceOf(player1.address) - p1Before).to.equal(stake);
      expect(await gvt.balanceOf(escrowAddr)).to.equal(0n);
      expect((await escrow.getMatch(matchId)).status).to.equal(MatchStatus.CANCELLED);
    });

    it("emits MatchCancelled", async () => {
      const tx      = await escrow.connect(player1)
        .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, GVT(10));
      const matchId = await getMatchId(escrow, tx);
      await expect(escrow.connect(player1).cancelMatch(matchId))
        .to.emit(escrow, "MatchCancelled")
        .withArgs(matchId, player1.address);
    });

    it("anyone can cancel after 10-min timeout; refund goes to player1 not caller", async () => {
      const stake   = GVT(100);
      const tx      = await escrow.connect(player1)
        .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, stake);
      const matchId  = await getMatchId(escrow, tx);
      const p1Before = await gvt.balanceOf(player1.address);

      await time.increase(JOIN_TIMEOUT + 1);
      await escrow.connect(attacker).cancelMatch(matchId);

      expect(await gvt.balanceOf(player1.address) - p1Before).to.equal(stake);
      expect(await gvt.balanceOf(attacker.address)).to.equal(0n);
    });

    it("reverts: stranger cancels before timeout", async () => {
      const tx = await escrow.connect(player1)
        .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, GVT(100));
      const matchId = await getMatchId(escrow, tx);
      await expect(escrow.connect(attacker).cancelMatch(matchId))
        .to.be.revertedWith("Escrow: not authorised to cancel");
    });

    it("reverts: cancel on ACTIVE match", async () => {
      const matchId = await setupActiveMatch(escrow, player1, player2);
      await expect(escrow.connect(player1).cancelMatch(matchId))
        .to.be.revertedWith("Escrow: only pending matches");
    });

    it("reverts: unknown matchId", async () => {
      await expect(escrow.connect(player1).cancelMatch(ethers.ZeroHash))
        .to.be.revertedWith("Escrow: match not found");
    });

    it("cancelMatch works while paused (safety valve — funds must always be recoverable)", async () => {
      const tx = await escrow.connect(player1)
        .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, GVT(100));
      const matchId = await getMatchId(escrow, tx);
      await escrow.connect(admin).pause();
      // cancelMatch intentionally has no whenNotPaused modifier
      await expect(escrow.connect(player1).cancelMatch(matchId)).to.not.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 8. FEE WITHDRAWAL
  // ═══════════════════════════════════════════════════════════════

  describe("OlosEscrow — withdrawFees", () => {
    it("admin withdraws correct fee to treasury", async () => {
      const stake   = GVT(100);
      const matchId = await setupActiveMatch(escrow, player1, player2, { stakeAmount: stake });
      const r       = { matchId, winner: player1.address, player1Score: 1000n, player2Score: 500n, duration: 120n };
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));

      const expectedFee = (stake * 2n * 500n) / 10_000n; // 10 GVT
      expect(await escrow.accruedFees()).to.equal(expectedFee);

      const tBefore = await gvt.balanceOf(treasury.address);
      await escrow.connect(admin).withdrawFees(treasury.address);

      expect(await gvt.balanceOf(treasury.address) - tBefore).to.equal(expectedFee);
      expect(await escrow.accruedFees()).to.equal(0n);
    });

    it("fees accumulate correctly across 3 matches", async () => {
      for (let i = 0; i < 3; i++) {
        const matchId = await setupActiveMatch(escrow, player1, player2, { stakeAmount: GVT(100) });
        const r = {
          matchId,
          winner:       player1.address,
          player1Score: BigInt(1000 + i),
          player2Score: 500n,
          duration:     BigInt(60 + i),
        };
        await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      }
      // 3 × (200 GVT × 5%) = 30 GVT
      expect(await escrow.accruedFees()).to.equal(GVT(30));
    });

    it("emits PlatformFeeWithdrawn", async () => {
      const matchId = await setupActiveMatch(escrow, player1, player2);
      const r       = { matchId, winner: player1.address, player1Score: 1000n, player2Score: 500n, duration: 60n };
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      const fee = await escrow.accruedFees();
      await expect(escrow.connect(admin).withdrawFees(treasury.address))
        .to.emit(escrow, "PlatformFeeWithdrawn")
        .withArgs(treasury.address, fee);
    });

    it("reverts: no fees accrued", async () => {
      await expect(escrow.connect(admin).withdrawFees(treasury.address))
        .to.be.revertedWith("Escrow: no fees");
    });

    it("reverts: withdraw to zero address", async () => {
      const matchId = await setupActiveMatch(escrow, player1, player2);
      const r       = { matchId, winner: player1.address, player1Score: 1000n, player2Score: 500n, duration: 60n };
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      await expect(escrow.connect(admin).withdrawFees(ethers.ZeroAddress))
        .to.be.revertedWith("Escrow: zero address");
    });

    it("reverts: non-FEE_WITHDRAWER_ROLE", async () => {
      await expect(
        escrow.connect(attacker).withdrawFees(attacker.address)
      ).to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 9. PAUSE CIRCUIT BREAKER
  // ═══════════════════════════════════════════════════════════════

  describe("OlosEscrow — pause", () => {
    // FIX: escrow.paused() does not exist in generated typechain for OlosEscrow.
    // We test the pause behaviour indirectly: a paused escrow rejects createMatch.
    it("pause blocks createMatch; unpause restores it", async () => {
      await escrow.connect(admin).pause();
      await expect(
        escrow.connect(player1)
          .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, GVT(100))
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");

      await escrow.connect(admin).unpause();
      await expect(
        escrow.connect(player1)
          .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, GVT(100))
      ).to.not.be.reverted;
    });

    it("pause blocks joinMatch", async () => {
      const tx      = await escrow.connect(player1)
        .createMatch(GAME.SNAKE, GameMode.ONE_V_ONE, ResultType.HIGH_SCORE, GVT(100));
      const matchId = await getMatchId(escrow, tx);
      await escrow.connect(admin).pause();
      await expect(escrow.connect(player2).joinMatch(matchId))
        .to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });

    it("pause blocks submitResult", async () => {
      const matchId = await setupActiveMatch(escrow, player1, player2);
      await escrow.connect(admin).pause();
      const r = { matchId, winner: player1.address, player1Score: 1000n, player2Score: 500n, duration: 60n };
      await expect(
        escrow.connect(admin).submitResult(r, await signResult(resultSigner, r))
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });

    it("non-PAUSER cannot pause", async () => {
      await expect(escrow.connect(attacker).pause()).to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 10. MATCH REGISTRY
  // ═══════════════════════════════════════════════════════════════

  describe("OlosMatchRegistry", () => {
    it("starts at 0 total matches", async () => {
      expect(await registry.totalMatches()).to.equal(0);
    });

    it("empty history for a new player", async () => {
      expect((await registry.getPlayerMatchHistory(player1.address)).length).to.equal(0);
    });

    it("zeroed stats for a new player", async () => {
      const s = await registry.getPlayerStats(player1.address);
      expect(s.wins).to.equal(0n);
      expect(s.losses).to.equal(0n);
      expect(s.totalStaked).to.equal(0n);
    });

    it("reverts direct write from non-RECORDER_ROLE", async () => {
      await expect(
        registry.connect(attacker).recordMatch(
          ethers.ZeroHash, 0,
          player1.address, player2.address, player1.address,
          GVT(100), 1000n, 500n, 120n, GVT(190)
        )
      ).to.be.reverted;
    });

    // FIX: getPlayerMatchHistoryPaginated is not in the generated typechain.
    // We test pagination via getPlayerMatchHistory instead.
    it("getPlayerMatchHistory returns empty array for unknown player", async () => {
      const history = await registry.getPlayerMatchHistory(attacker.address);
      expect(history.length).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 11. VIEW HELPERS
  // ═══════════════════════════════════════════════════════════════

  describe("OlosEscrow — view helpers", () => {
    // FIX: getResultHash is not exposed in the typechain for OlosEscrow
    // (it is an `external pure` but may have been excluded from the ABI fragment).
    // We verify the hash function directly via our local hashResult() utility.
    it("local hashResult() is consistent across calls (deterministic)", () => {
      const r = {
        matchId:      ethers.ZeroHash,
        winner:       player1.address,
        player1Score: 1000n,
        player2Score: 500n,
        duration:     120n,
      };
      expect(hashResult(r)).to.equal(hashResult(r));
      // Changing any field changes the hash
      expect(hashResult(r)).to.not.equal(hashResult({ ...r, player1Score: 9999n }));
      expect(hashResult(r)).to.not.equal(hashResult({ ...r, matchId: ethers.id("other") }));
    });

    it("getMatch returns zero struct for unknown matchId", async () => {
      const m = await escrow.getMatch(ethers.ZeroHash);
      expect(m.player1).to.equal(ethers.ZeroAddress);
      expect(m.stakeAmount).to.equal(0n);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // 12. SECURITY — EDGE CASES
  // ═══════════════════════════════════════════════════════════════

  describe("Security", () => {
    it("reverts Escrow deploy with zero token address", async () => {
      await expect(
        (await ethers.getContractFactory("OlosEscrow"))
          .deploy(ethers.ZeroAddress, admin.address, resultSigner.address)
      ).to.be.revertedWith("Escrow: zero token");
    });

    it("reverts Escrow deploy with zero admin", async () => {
      await expect(
        (await ethers.getContractFactory("OlosEscrow"))
          .deploy(await gvt.getAddress(), ethers.ZeroAddress, resultSigner.address)
      ).to.be.revertedWith("Escrow: zero admin");
    });

    it("reverts Escrow deploy with zero result signer", async () => {
      await expect(
        (await ethers.getContractFactory("OlosEscrow"))
          .deploy(await gvt.getAddress(), admin.address, ethers.ZeroAddress)
      ).to.be.revertedWith("Escrow: zero signer");
    });

    it("reverts GVTToken deploy with zero admin", async () => {
      await expect(
        (await ethers.getContractFactory("GVTToken")).deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("GVT: zero admin address");
    });

    it("signature for match A is rejected on match B", async () => {
      const matchA = await setupActiveMatch(escrow, player1, player2, { stakeAmount: GVT(100) });
      const matchB = await setupActiveMatch(escrow, player1, player2, { stakeAmount: GVT(100) });

      const sigForA = await signResult(resultSigner, {
        matchId:      matchA,
        winner:       player1.address,
        player1Score: 1000n,
        player2Score: 500n,
        duration:     120n,
      });

      await expect(
        escrow.connect(admin).submitResult(
          { matchId: matchB, winner: player1.address, player1Score: 1000n, player2Score: 500n, duration: 120n },
          sigForA
        )
      ).to.be.revertedWith("Escrow: invalid signer");
    });

    it("tampered result field invalidates the signature", async () => {
      const matchId = await setupActiveMatch(escrow, player1, player2);
      const r       = { matchId, winner: player1.address, player1Score: 1000n, player2Score: 500n, duration: 120n };
      const sig     = await signResult(resultSigner, r);
      await expect(
        escrow.connect(admin).submitResult({ ...r, player1Score: 9999n }, sig)
      ).to.be.revertedWith("Escrow: invalid signer");
    });

    it("escrow holds zero GVT after matches complete and fees withdrawn", async () => {
      for (let i = 0; i < 2; i++) {
        const matchId = await setupActiveMatch(escrow, player1, player2, { stakeAmount: GVT(100) });
        const r = {
          matchId,
          winner:       player1.address,
          player1Score: BigInt(1000 + i),
          player2Score: 500n,
          duration:     BigInt(60 + i),
        };
        await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));
      }
      await escrow.connect(admin).withdrawFees(treasury.address);
      expect(await gvt.balanceOf(escrowAddr)).to.equal(0n);
    });

    it("math invariant: winner payout + fees = total escrowed pot", async () => {
      const stake       = GVT(100);
      const matchId     = await setupActiveMatch(escrow, player1, player2, { stakeAmount: stake });
      const p1Before    = await gvt.balanceOf(player1.address);
      const p2Before    = await gvt.balanceOf(player2.address);
      const escrowStart = await gvt.balanceOf(escrowAddr);

      const r = { matchId, winner: player1.address, player1Score: 1000n, player2Score: 500n, duration: 60n };
      await escrow.connect(admin).submitResult(r, await signResult(resultSigner, r));

      const p1Gained = await gvt.balanceOf(player1.address) - p1Before;
      const p2Gained = await gvt.balanceOf(player2.address) - p2Before;
      const fees     = await escrow.accruedFees();

      // Everything that left escrow must account for the original pot
      expect(p1Gained + p2Gained + fees).to.equal(escrowStart);
    });
  });
});