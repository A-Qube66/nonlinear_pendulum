# 单摆动力学实验室

一个面向物理教学与参数探索的交互式非线性单摆仿真项目。后端使用
`scipy.integrate.solve_ivp` 直接积分大角度非线性方程，前端使用原生 Canvas
完成实时动画与数据曲线，不依赖第三方前端图表库。

## 功能

- 初始摆角（1°–80°）、摆长（0.3–3.0 m）、重力加速度（1–20 m/s²）实时调节
- 空气阻尼开关、暂停/播放、重置、进度定位与 0.5×–2× 播放速度
- 单摆运动、运动残影、重力/约束力矢量、水平投影同步动画
- 非线性数值角位移与小角度余弦参考曲线对照
- 实时相对误差、动能/势能/总机械能和 `θ—θ̇` 相空间轨迹
- 从数值轨迹测得真实周期，并与 `T₀ = 2π√(L/g)` 比较
- 运动方程、参数代入结果和运动状态随实验条件动态切换
- 小角度简谐、大角度周期偏移、阻尼能量耗散三个一键实验预设

## 快速开始

建议使用 Python 3.11 或更高版本。

```bash
python -m venv .venv
```

Windows PowerShell：

```powershell
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

macOS / Linux：

```bash
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

打开 <http://127.0.0.1:5000>。也可以使用 Flask CLI：

```bash
flask --app app run --debug
```

## 物理模型

项目采用质量为 `m` 的质点和长度为 `L` 的无质量刚性摆杆。无阻尼时：

```text
θ̈ + (g/L) sin θ = 0
```

开启空气阻尼后，使用线性黏性阻尼模型：

```text
θ̈ + γθ̇ + (g/L) sin θ = 0,  γ = 0.18 s⁻¹
```

求解器为 `solve_ivp(method="DOP853")`，相对容差 `1e-9`，绝对容差
`1e-11`，以 60 Hz 采样 30 秒轨迹。实际周期由连续两个同向正峰值之间的
角速度零交叉插值得到；小角度理论周期只作为参考，不参与运动方程求解。

能量按以下定义计算：

```text
K = ½m(Lθ̇)²
U = mgL(1 - cos θ)
E = K + U
```

相对误差以初始振幅归一化，避免余弦参考曲线过零点时出现无穷大：

```text
error = |θ_nonlinear - θ_SHM| / |θ₀| × 100%
```

## 项目结构

```text
.
├── app.py                     # Flask 入口与 JSON API
├── pendulum_sim/
│   ├── __init__.py
│   └── model.py               # 参数校验、ODE、solve_ivp 与物理量计算
├── templates/
│   └── index.html             # 语义化页面结构
├── static/
│   ├── css/style.css          # 响应式实验室界面
│   └── js/
│       ├── app.js             # 状态、交互、播放与 API 调度
│       ├── charts.js          # Canvas 曲线渲染器
│       └── pendulum.js        # 单摆、残影、受力与投影渲染器
├── tests/test_model.py        # 周期、守恒、耗散和参数边界测试
└── requirements.txt
```

## 可观察的物理现象

1. 选择“小角度”：数值解与余弦曲线基本重合，相空间为近似椭圆。
2. 选择“大角度”：真实周期明显长于小角度公式，误差随时间产生相位累积。
3. 选择“能量耗散”：总机械能单调下降，相空间轨迹向原点螺旋收缩。
4. 改变摆长或重力：比较周期指标如何按 `√(L/g)` 缩放。

## 测试

```bash
python -m pytest -q
```

测试覆盖小角度周期极限、大角度周期增长、无阻尼能量守恒、阻尼耗散和参数校验。

