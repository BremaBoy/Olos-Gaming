import { ethers, network, run } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  const RESULT_SIGNER = process.env.RESULT_SIGNER_ADDRESS || deployer.address;
  const ADMIN         = process.env.ADMIN_ADDRESS         || deployer.address;

  console.log(`\nDeploying OLOS MVP on [${networkName}]`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Admin    : ${ADMIN}`);
  console.log(`Signer   : ${RESULT_SIGNER}\n`);

  // 1. GVT Token
  const GVT = await ethers.getContractFactory("GVTToken");
  const gvt = await GVT.deploy(ADMIN);
  await gvt.waitForDeployment();
  const gvtAddr = await gvt.getAddress();
  console.log(`✓ GVTToken          : ${gvtAddr}`);

  // 2. Match Registry
  const Registry = await ethers.getContractFactory("OlosMatchRegistry");
  const registry = await Registry.deploy(ADMIN);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log(`✓ OlosMatchRegistry : ${registryAddr}`);

  // 3. Escrow
  const Escrow = await ethers.getContractFactory("OlosEscrow");
  const escrow = await Escrow.deploy(gvtAddr, ADMIN, RESULT_SIGNER);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log(`✓ OlosEscrow        : ${escrowAddr}`);

  // 4. Wire roles
  const MINTER_ROLE   = await gvt.MINTER_ROLE();
  const RECORDER_ROLE = await registry.RECORDER_ROLE();

  await (await gvt.grantRole(MINTER_ROLE, escrowAddr)).wait();
  console.log(`✓ Escrow granted MINTER_ROLE on GVTToken`);

  await (await registry.grantRole(RECORDER_ROLE, escrowAddr)).wait();
  console.log(`✓ Escrow granted RECORDER_ROLE on OlosMatchRegistry`);

  // 5. Beta mint (testnet only)
  if (networkName !== "mainnet" && networkName !== "base") {
    await (await gvt.mint(deployer.address, ethers.parseEther("1000000"))).wait();
    console.log(`✓ Minted 1,000,000 GVT to deployer (testnet)`);
  }

  // 6. Save manifest
  const manifest = {
    network: networkName,
    deployedAt: new Date().toISOString(),
    contracts: {
      GVTToken:           { address: gvtAddr,      args: [ADMIN] },
      OlosMatchRegistry:  { address: registryAddr,  args: [ADMIN] },
      OlosEscrow:         { address: escrowAddr,    args: [gvtAddr, ADMIN, RESULT_SIGNER] },
    },
  };
  const dir = join(__dirname, "../deployments");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${networkName}.json`), JSON.stringify(manifest, null, 2));
  console.log(`✓ Manifest saved → deployments/${networkName}.json`);

  // 7. Verify (non-local) — with retry on rate limit
  if (networkName !== "hardhat" && networkName !== "localhost") {
    console.log("\n7. Verifying contracts (waiting 60s for Etherscan to index)...");
    await new Promise((r) => setTimeout(r, 60_000));

    const contracts = [
      { address: gvtAddr,      args: [ADMIN],                           name: "GVTToken"          },
      { address: registryAddr, args: [ADMIN],                           name: "OlosMatchRegistry"  },
      { address: escrowAddr,   args: [gvtAddr, ADMIN, RESULT_SIGNER],   name: "OlosEscrow"         },
    ];

    for (const contract of contracts) {
      let attempts = 0;
      while (attempts < 3) {
        try {
          await run("verify:verify", {
            address:              contract.address,
            constructorArguments: contract.args,
          });
          console.log(`   ✓ ${contract.name} verified`);
          break;
        } catch (e: any) {
          attempts++;
          if (e?.message?.includes("Already Verified") || e?.message?.includes("already verified")) {
            console.log(`   ✓ ${contract.name} already verified`);
            break;
          }
          if (attempts < 3) {
            console.log(`   ⚠ ${contract.name} verify failed (attempt ${attempts}/3), retrying in 15s...`);
            await new Promise((r) => setTimeout(r, 15_000));
          } else {
            console.warn(`   ✗ ${contract.name} verify failed after 3 attempts:`, e?.message);
          }
        }
      }
    }
  }

  console.log("\nDeployment complete ✓");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });