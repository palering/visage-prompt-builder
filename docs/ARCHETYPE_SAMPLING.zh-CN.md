# 参数范围预设与一致性抽样（v0.4）

## 这是什么

“从一个风格范围随机抽一张脸”是合理的产品需求。这里把它拆成三层，而不是把所有面部轴独立均匀随机化：

1. **形态层**：先按权重选一个结构家族，再在该家族范围内抽样。轮廓类别与家族绑定；相关的唇部、宽度、丰满度控制共享随机分量
2. **外观层**：目前 `beautiful` 表示一种编辑式美妆方向。它不是“美丽分数”，更不是所有人的审美标准
3. **角色呈现层**：`elegant`、`sensual`、`sinister`、`fierce`、`grotesque`、`ruthless` 表示表情、表演和光线方向。不是由骨相预测人格

所有默认角色均为虚构成年人、未指定性别呈现。所有方向共用结构家族；同一 seed 切换呈现方向，结构参数保持一致。反派通过眯眼、皱眉、紧张嘴部、控制表情和戏剧光线等表演手段表达，不把族裔、肤色、疤痕、残障或具体鼻型当作邪恶依据。`grotesque` 在本版本表示真人狰狞表演，仍保持真实人体解剖；不支持怪物构造。

## 直接使用

```bash
npm run sample -- --list
npm run sample -- --archetype beautiful,elegant --seed demo --out-dir samples/elegant
npm run sample -- --archetype sinister --seed demo --out-dir samples/sinister
npm run sample -- --archetype sensual --out-dir samples/sensual
npm run sample -- --archetype ruthless --seed 0
```

没有 `--out-dir` 时，stdout 输出一个 JSON 包，内含参数、prompt 和可重现信息。省略 seed 会生成一次随机 seed 并保存；seed `0` 是有效字符串。组合顺序无关；`beautiful,elegant` 与 `elegant,beautiful` 相同。最多组合一个外观方向和一个角色呈现方向，所以 `elegant,sinister` 会明确报冲突，不做无意义混合。

每个独立输出目录含：

- `profile.json`：可编辑的 face-v0.2 参数及抽样元数据
- `prompt.txt`：已经编译的完整提示词
- `manifest.json`：seed、算法/预设版本、配置与编译器指纹、选中家族、实际范围、编译选项和输出摘要

重新编译保存的参数：

```bash
npm run build -- samples/elegant/profile.json --preset profile --enhancers
```

原来的 `--preset calibration|profile|none` 仍只控制拍摄/编译语义。抽样器明确采用 `profile + enhancers`，使表情与光线真正进入提示词。默认 build 仍使用中性校准；不能期待它显示角色表情，`calibration + enhancers` 仍报冲突。

## 范围如何编辑

所有默认定义在 `presets/archetypes.v0.1.json`。可以复制为新配置，并通过 `--catalog my-catalog.json` 使用。配置包含：

- `morphology_bundles`：三个可检查的共享结构家族（soft-oval、defined-taper、broad-contour），带显式 `weight`、固定轮廓和数值范围
- `ranges` 中每个控制的 `min / mode / max`：边界及偏好中心
- `group`：共享随机分量的组名；同组形成相关变化
- `correlation.shared_weight / local_weight`：默认 0.75 / 0.25，总和必须是 1
- `archetypes`：appearance 或 presentation 配方，分开记录 fixed 与 ranges

抽样先得到组级共享分位数和字段级局部分位数，按权重混合，再使用三角分布逆函数映射到 min/mode/max。混合分位数更集中在中央，因此最终不是标准独立三角分布。数值四舍五入为两位小数，并夹回边界。不同组按不同键独立取随机量；字段随机量来自 seed+字段键的 SHA-256，不因增加其他配方而挪动随机序列。

这里的 0–100 是编译器的语义控制轴，不是毫米、比例、医学测量或百分位。不同字段之间不能直接比较大小作为解剖约束。现阶段的一致性来自结构家族、类别绑定和相关变化；尚未建立完整三维形态模型或图像统计拟合。范围是可修订的人工艺术假设，没有“科学验证的美丽脸型区间”之意。

对未来版本，更合理的校准方式是用同一图像模型做成组盲评，观察哪个参数真的有效，再修订预设及版本；不要仅凭数字精确就认为视觉控制精确。

## 安全与复现边界

- 同 seed、同配置、同算法和编译器版本得到相同 JSON/prompt；不是相同图像人物身份保证。模型也可能自行改变未指定的性别呈现、服装或其他外观
- 如需限定性别呈现，可在保存的 `profile.json` 中明确编辑 `subject.gender_presentation`（例如 `woman`），再用 `profile + enhancers` 编译。此时原 manifest 的文件摘要不再匹配，应视为新的人工编辑结果；抽样器暂不支持加载基础人物或身份参考
- 每个结构字段有九档文字量化，所以相邻数字可能生成相同措辞；每个 seed 不保证产生唯一 prompt
- 元数据不进入图像提示词。不能凭摘要恢复缺失配置；要重抽旧结果，应保留对应配置和代码。保存的 profile 可直接重新编译，不需重新抽样
- 未知字段、错误类型、范围越界、固定值/范围冲突和组合控制冲突会报错，不能静默忽略
- 默认配置禁止采样 subject 年龄/性别/appearance 或肤色；扩展这些能力应另行设计，而非当作反派标记
- 已存在的输出目录需要确认或 `--force`；含无关文件、软链接或目录型输出会被拒绝，即使强制也不清空
- 三个文件先写入临时目录，再整体替换；确认后目录被改动会中止。文件系统崩溃/断电不属于完全原子持久性保证
- 本次仅实现本地 CLI/schema 抽样，没有推送、部署、图像 API 或网页 UI 集成

## 内置方向

- `beautiful`：编辑式美丽外观，淡妆、自然皮肤和整洁露出轮廓的发型
- `elegant`：从容、克制的微笑和柔和均衡光线
- `sensual`：成年、完整着装的自信性感肖像，放松视线与微分双唇
- `sinister`：虚构阴险角色表演，收窄眼神和克制的非对称微笑
- `fierce`：虚构凶恶角色表演，皱眉、紧张嘴部与对峙视线
- `grotesque`：夸张狰狞表演；无伤残/毁容暗示
- `ruthless`：虚构狠毒角色表演，克制冷峻、无笑容的凝视
