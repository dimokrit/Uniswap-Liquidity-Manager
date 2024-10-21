import { expect } from "chai"
import { ethers } from "hardhat"
import hre from 'hardhat'
import { Contract } from "ethers"
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers"
import { abi as uniswapV3PoolAbi } from "@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json"
describe("UniswapV3LiquidityManager", function () {
  let liquidityManager: any
  let uniswap: any
  let pool: any
  let token0: any
  let token1: any
  let a: any
  let signer: SignerWithAddress;
  const tokenAmount = ethers.parseEther('1')
  const desiredWidth = 5000

  before(async function () {
    // Разворачиваем Uniswap с помощью hardhat-uniswap
    [signer] = await ethers.getSigners()
    uniswap = await hre.uniswapV3.deploy(signer);

    // Создаем токены
    token0 = await hre.uniswapV3.createERC20("Token0", "TOK0", signer)
    token1 = await hre.uniswapV3.createERC20("Token1", "TOK1", signer)

    // Создаем пул
    const fee = 500
    await uniswap.factory.createPool(token0.target, token1.target, fee)
    const poolAddress = await uniswap.factory.getPool(token0.target, token1.target, fee)
    pool = new Contract(poolAddress, uniswapV3PoolAbi, signer)

    // Инициализируем
    const price = 100;
    const sqrtPrice = Math.sqrt(price);
    const sqrtPriceX96 = BigInt(sqrtPrice * (2 ** 96));
    await pool.initialize(sqrtPriceX96);

    // Деплоим менеджер
    const LiquidityManager = await ethers.getContractFactory("UniswapV3LiquidityManager")
    liquidityManager = await LiquidityManager.deploy(uniswap.positionManager.target)
  })

  it("should add liquidity", async function () {
    // Апрувим токены для контракта
    await token0.approve(liquidityManager.target, tokenAmount)
    await token1.approve(liquidityManager.target, tokenAmount)

    // Добавляем ликвидность
    await liquidityManager.addLiquidity(pool.target, tokenAmount, tokenAmount, desiredWidth)

    // Проверяем успешное добавление ликвидности
    const positions = await uniswap.positionManager.positions(1)
    expect(positions.liquidity).to.be.gt(0)
    expect(positions.token0).to.equal(token0.target)
    expect(positions.token1).to.equal(token1.target)
  })

  it("should correct position width", async function () {
    // Получаем граничные тики
    const positions = await uniswap.positionManager.positions(1)
    const lowerTick = positions[5]
    const upperTick = positions[6]

    // Высчитываем граничные цены
    const lowerSqrtPriceX96 = await pool.calculateSqrtPriceX96(lowerTick)
    const upperSqrtPriceX96 = await pool.calculateSqrtPriceX96(upperTick)
    const lowerPrice = Math.floor((Number(lowerSqrtPriceX96) / (2**96)) ** 2)
    const upperPrice = Math.floor((Number(upperSqrtPriceX96) / (2**96)) ** 2)

    // Считаем ширину по нашей формуле
    const width = Math.floor(((upperPrice - lowerPrice) * 10000) / (upperPrice + lowerPrice))

    // Учитываем погрешность вычислений для проверки
    expect(width < desiredWidth && width > desiredWidth - 100).to.equal(true)
  })
})
