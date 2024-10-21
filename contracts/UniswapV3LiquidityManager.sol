// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/INonfungiblePositionManager.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-core/contracts/libraries/TickMath.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract UniswapV3LiquidityManager {
    event LiqAdded(address pool, int24 lowerTick, int24 upperTick, uint256 amount0, uint256 amount1);

    INonfungiblePositionManager public immutable positionManager;

    constructor(INonfungiblePositionManager _positionManager) {
        positionManager = _positionManager;
    }
    
    function addLiquidity(
        address poolAddress,
        uint amount0Desired,
        uint amount1Desired,
        uint desiredWidth
    ) external {
        require(poolAddress != address(0), "Invalid pool address");
        require(desiredWidth > 0 && desiredWidth < 10000, "Invalid width");
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
        require(address(pool) != address(0), "Pool does not exist");

        // Собираем токены и апруваем для positionManager
        IERC20(pool.token0()).transferFrom(msg.sender, address(this), amount0Desired);
        IERC20(pool.token1()).transferFrom(msg.sender, address(this), amount1Desired);
        IERC20(pool.token0()).approve(address(positionManager), amount0Desired);
        IERC20(pool.token1()).approve(address(positionManager), amount1Desired);

        // Получаем текущую цену
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();

        // Расчитываем диапазоны
        (uint lowerPrice, uint upperPrice) = calculatePriceRange(sqrtPriceX96, desiredWidth);

        // Преобразуем цены в тики
        int24 lowerTick = TickMath.getTickAtSqrtRatio(uint160(sqrt(lowerPrice) << 96));
        int24 upperTick = TickMath.getTickAtSqrtRatio(uint160(sqrt(upperPrice) << 96));
    
        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: pool.token0(),
            token1: pool.token1(),
            fee: pool.fee(),
            tickLower: lowerTick,
            tickUpper: upperTick,
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: 0,
            amount1Min: 0,
            recipient: msg.sender,
            deadline: block.timestamp + 600
        });

        positionManager.mint(params);
    }


    function calculatePriceRange(uint160 sqrtPriceX96, uint desiredWidth) public pure returns (uint, uint) {
        uint middlePrice = uint((sqrtPriceX96 / 2**96) ** 2);

        uint lowerPrice = uint((middlePrice - ((middlePrice * desiredWidth)) / 10000));
        uint upperPrice = uint((middlePrice + ((middlePrice * desiredWidth)) / 10000));
        return (lowerPrice, upperPrice);
    }

    function calculateSqrtPriceX96(int24 tick) public pure returns (uint160) {
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick);
        return sqrtPriceX96;
    }

    function sqrt(uint x) public pure returns (uint y) {
        uint z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
