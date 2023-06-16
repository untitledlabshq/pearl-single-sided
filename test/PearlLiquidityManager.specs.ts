import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { expect } from "chai"
import { ethers } from "hardhat"

describe("Lock", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function pearlLiquidityManagerFixures() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners()

    // Deploy Pearl Exchange
    // load
    const PearlPairFactory = await ethers.getContractFactory("PairFactory")
    const WETH = await ethers.getContractFactory("WETH")
    const PearlRouter = await ethers.getContractFactory("Router")
    const PearlLiquidityManager = await ethers.getContractFactory("PearlLiquidityManager")

    // deploy
    const weth = await WETH.deploy()
    const pearlPairFactory = await PearlPairFactory.deploy()
    await pearlPairFactory.initialize()
    const pearlRouter = await PearlRouter.deploy(pearlPairFactory.address, weth.address)

    // deploy test tokens
    const TestERC20 = await ethers.getContractFactory("TestToken")
    const dai = await TestERC20.deploy("18", ethers.utils.parseUnits("10000000", 18))
    const usdr = await TestERC20.deploy("18", ethers.utils.parseUnits("10000000", 18))
    const usdc = await TestERC20.deploy("6", ethers.utils.parseUnits("10000000", 6))

    // console.log({dai: dai.address, usdr: usdr.address, usdc: usdc.address})
    // Launch pairs
    await pearlPairFactory.createPair(dai.address, usdr.address, true)
    const daiUsdrPair = await pearlPairFactory.getPair(dai.address, usdr.address, true)
    const usdrDaiPair = await pearlPairFactory.getPair(usdr.address, dai.address, true)

    // console.log({ daiUsdrPair, usdrDaiPair})
    const daiUsdrPairContract = await ethers.getContractAt("Pair", daiUsdrPair)

    // Retrieve the block by its number
    const timestamp = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp

    let addLiquidityParams

    // add liquidity to dai/usdr pair
    addLiquidityParams = {
      tokenA: dai.address,
      tokenB: usdr.address,
      stable: true,
      amountADesired: ethers.utils.parseEther("1000000"),
      amountBDesired: ethers.utils.parseEther("1000000"),
      amountAMin: 0,
      amountBMin: 0,
      to: await owner.getAddress(),
      deadline: timestamp + 1000000,
    }

    await dai.approve(pearlRouter.address, await dai.balanceOf(await owner.getAddress()))
    await usdr.approve(pearlRouter.address, await usdr.balanceOf(await owner.getAddress()))

    await pearlRouter.addLiquidity(
      addLiquidityParams.tokenA,
      addLiquidityParams.tokenB,
      addLiquidityParams.stable,
      addLiquidityParams.amountADesired,
      addLiquidityParams.amountBDesired,
      addLiquidityParams.amountAMin,
      addLiquidityParams.amountBMin,
      addLiquidityParams.to,
      addLiquidityParams.deadline
    )

    // add liquidity to usdc/usdr pair
    await pearlPairFactory.createPair(usdc.address, usdr.address, true)

    const usdcUsdrPair = await pearlPairFactory.getPair(usdc.address, usdr.address, true)
    const usdcUsdrPairContract = await ethers.getContractAt("Pair", usdcUsdrPair)

    addLiquidityParams = {
      tokenA: usdc.address,
      tokenB: usdr.address,
      stable: true,
      amountADesired: ethers.utils.parseUnits("1000000", 6),
      amountBDesired: ethers.utils.parseEther("1000000"),
      amountAMin: 0,
      amountBMin: 0,
      to: await owner.getAddress(),
      deadline: timestamp + 1000000,
    }

    await usdc.approve(pearlRouter.address, await usdc.balanceOf(await owner.getAddress()))
    await usdr.approve(pearlRouter.address, await usdr.balanceOf(await owner.getAddress()))

    await pearlRouter.addLiquidity(
      addLiquidityParams.tokenA,
      addLiquidityParams.tokenB,
      addLiquidityParams.stable,
      addLiquidityParams.amountADesired,
      addLiquidityParams.amountBDesired,
      addLiquidityParams.amountAMin,
      addLiquidityParams.amountBMin,
      addLiquidityParams.to,
      addLiquidityParams.deadline
    )

    // create DAI/USDC pair
    await pearlPairFactory.createPair(dai.address, usdc.address, true)

    const daiUsdcPair = await pearlPairFactory.getPair(dai.address, usdc.address, true)
    const daiUsdcPairContract = await ethers.getContractAt("Pair", daiUsdcPair)

    addLiquidityParams = {
      tokenA: dai.address,
      tokenB: usdc.address,
      stable: true,
      amountADesired: ethers.utils.parseEther("1000000"),
      amountBDesired: ethers.utils.parseUnits("1000000", 6),
      amountAMin: 0,
      amountBMin: 0,
      to: await owner.getAddress(),
      deadline: timestamp + 1000000,
    }

    await dai.approve(pearlRouter.address, await dai.balanceOf(await owner.getAddress()))
    await usdc.approve(pearlRouter.address, await usdc.balanceOf(await owner.getAddress()))

    await pearlRouter.addLiquidity(
      addLiquidityParams.tokenA,
      addLiquidityParams.tokenB,
      addLiquidityParams.stable,
      addLiquidityParams.amountADesired,
      addLiquidityParams.amountBDesired,
      addLiquidityParams.amountAMin,
      addLiquidityParams.amountBMin,
      addLiquidityParams.to,
      addLiquidityParams.deadline
    )

    const SPLIT_RATIO = 5000
    const pearlLiquidityManager = await PearlLiquidityManager.deploy(
      dai.address,
      usdr.address,
      usdc.address,
      SPLIT_RATIO, // 50%
      pearlRouter.address
    )

    return {
      pearlLiquidityManager,
      dai,
      usdc,
      usdr,
      pearlRouter,
      daiUsdrPairContract,
      usdcUsdrPairContract,
      daiUsdcPairContract,
      SPLIT_RATIO,
      owner,
    }
  }

  describe("Deployment", async () => {
    it("should set the DAI address", async () => {
      const { pearlLiquidityManager, dai } = await loadFixture(pearlLiquidityManagerFixures)
      expect(await pearlLiquidityManager.dai()).to.equal(dai.address)
    })

    it("should set the USDR address", async () => {
      const { pearlLiquidityManager, usdr } = await loadFixture(pearlLiquidityManagerFixures)
      expect(await pearlLiquidityManager.usdr()).to.equal(usdr.address)
    })

    it("should set the USDC address", async () => {
      const { pearlLiquidityManager, usdc } = await loadFixture(pearlLiquidityManagerFixures)
      expect(await pearlLiquidityManager.usdc()).to.equal(usdc.address)
    })

    it("should set the split ratio", async () => {
      const { pearlLiquidityManager } = await loadFixture(pearlLiquidityManagerFixures)
      expect(await pearlLiquidityManager.splitRatio()).to.equal(5000)
    })

    it("should set the pearl router address", async () => {
      const { pearlLiquidityManager, pearlRouter } = await loadFixture(pearlLiquidityManagerFixures)
      expect(await pearlLiquidityManager.pearlRouter()).to.equal(pearlRouter.address)
    })
  })

  describe("addLiquidity", async () => {
    it("should add liquidity to the DAI/USDR pair", async () => {
      const { pearlLiquidityManager, dai, usdr, daiUsdrPairContract, SPLIT_RATIO } = await loadFixture(
        pearlLiquidityManagerFixures
      )

      const daiAmount = ethers.utils.parseUnits("10000", 18)
      await dai.approve(pearlLiquidityManager.address, daiAmount)
      const tx = await pearlLiquidityManager.addLiquidity(daiAmount)

      const transactionReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
      const filter = daiUsdrPairContract.filters.Mint() // Replace with your event name and arguments
      const logs = transactionReceipt.logs.filter((log) => {
        return filter.topics?.some((topic) => log.topics.includes(topic as string))
      })
      let eventData: any = []
      // Parse and process event logs
      logs.forEach((log) => {
        const parsedLog = daiUsdrPairContract.interface.parseLog(log)
        eventData.push(parsedLog.args)
      })

      const amount = daiAmount.mul(SPLIT_RATIO).div(10000).div(2)

      expect(amount).to.equal(eventData[0].amount1)
    })

    it("should add liquidity to the USDC/USDR pair", async () => {
      const { pearlLiquidityManager, dai, usdr, usdcUsdrPairContract, SPLIT_RATIO } = await loadFixture(
        pearlLiquidityManagerFixures
      )

      const reservesBefore = await usdcUsdrPairContract.getReserves()

      const daiAmount = ethers.utils.parseUnits("10000", 18)
      await dai.approve(pearlLiquidityManager.address, daiAmount)
      const tx = await pearlLiquidityManager.addLiquidity(daiAmount)

      const reservesAfter = await usdcUsdrPairContract.getReserves()

      const transactionReceipt = await ethers.provider.getTransactionReceipt(tx.hash)
      const filter = usdcUsdrPairContract.filters.Mint() // Replace with your event name and arguments
      const logs = transactionReceipt.logs.filter((log) => {
        return filter.topics?.some((topic) => log.topics.includes(topic as string))
      })
      let eventData: any = []
      // Parse and process event logs
      logs.forEach((log) => {
        const parsedLog = usdcUsdrPairContract.interface.parseLog(log)
        eventData.push(parsedLog.args)
      })

      const amount = daiAmount.mul(SPLIT_RATIO).div(10000).div(2)

      expect(reservesAfter._reserve0.sub(reservesBefore._reserve0)).to.equal(eventData[1].amount0)
    })
  })

  describe("sweep", async () => {
    it("should allow owner to sweep the tokens", async () => {
      const { pearlLiquidityManager, dai, usdr, owner } = await loadFixture(pearlLiquidityManagerFixures)

      await dai.transfer(pearlLiquidityManager.address, ethers.utils.parseEther("5"))
      const balanceBefore = await dai.balanceOf(pearlLiquidityManager.address)
      await pearlLiquidityManager.sweep(dai.address)
      const balanceAfter = await dai.balanceOf(pearlLiquidityManager.address)

      expect(balanceBefore.sub(balanceAfter)).to.equal(ethers.utils.parseEther("5"))
    })
  })

  describe("setSplitRatio", async () => {
    it("should allow owner to set the split ratio", async () => {
      const { pearlLiquidityManager, dai, usdr, owner } = await loadFixture(pearlLiquidityManagerFixures)

      await pearlLiquidityManager.changeSplitRatio(1000)
      expect(await pearlLiquidityManager.splitRatio()).to.equal(1000)
    })
  })
})
