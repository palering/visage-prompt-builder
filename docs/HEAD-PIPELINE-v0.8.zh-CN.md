# v0.8：整头组合、文案清理与眉鼻采样

## 本轮结论

1. 没有复现“选发型会自动误删妆容/表情”的跨层缺陷。`examples/appearance/hair-only.json` 原本显式把 makeup、expression、apparentAge 设为 off，适合隔离发型测试。以 seed `d2bcba6f43069a8cb777fcc7a984669e` 可复现相同缺项模式，但先前实际生成所用配置未找回，不能据此断言其具体成因。
2. 新增 `examples/appearance/hair-inherit.json`，只选择低马尾；继承 beautiful 的 minimal makeup、elegant 的 poised expression。不修改旧示例的 off 语义。
3. 过滤整值 `unspecified`，不再输出 `cut: unspecified`；解析记录仍保留原值。`none` 是明确约束（如无刘海、无配件），不会当噪声删除。
4. 数值中性档继续输出，避免把明确中性和缺失参数混同。减少泛化 balanced；改用 moderate、medium、medium-full、gently defined 等轴向适配词。去掉 slightly/moderately softly full 的叠词；eye_openness 编为 slightly open eyes，而非 open eye openness。
5. 新采样目录 v0.2 补齐 5 个眉部和 9 个鼻部现有数值轴；这些是探索用的作者范围，不是人体测量、族群平均或美貌标准。

## 组合契约

- 省略模块：按原 compiler 行为继承该 legacy 层；legacy hair/makeup/expression 仍需 enhancers=true
- `state: off`：只不写该 legacy 层，不等于“无妆”、不等于“中性表情”，也不移除模型先验
- `state: selected`：用该模块替换对应 legacy 层；不需要 enhancers=true，不动底板结构字段
- 没有省略→off 的自动补齐，不会因只选发型而删除妆容或表情
- calibration 有自身中性表情、最少妆容约束；off 只作用于 legacy 层，不取消 calibration 指令。selected 模块和 calibration 冲突时直接报错
- makeup 中的 browRendering 是眉妆；eyebrows 数值是基础眉形，二者不会在 JSON 层相互删除，但可能改变视觉解释

## 使用

```bash
npm test
npm run sample -- --archetype beautiful,elegant --seed demo --appearance examples/appearance/hair-inherit.json --out-dir samples/head-demo
npm run iterate -- --input samples/head-demo/profile.json --regions brows --seed brow-02 --out-dir samples/head-brows-02
npm run iterate -- --input samples/head-demo/profile.json --regions nose --seed nose-02 --out-dir samples/head-nose-02
```

完整整头示例见 `examples/head-v0.8/`。root source 是种子采样，complete-head 是对 source 的显式人口描述/构图和发型编辑；两者都保存 profile、prompt、manifest，后者还有 source-profile 和 diff。所谓完整指本轮示范包括脸部底板、眉鼻、继承的妆容/表情和现代发型，不意味着补全所有 schema 可选轴。

## 冻结记录与版本边界

- 保留 `presets/archetypes.v0.1.json`；新默认是 v0.2，抽样算法仍为 sampler-v0.1。新增字段不改变原字段随机键、范围或已有数值抽样。
- 旧记录不回填 eyebrows/nose，不偷偷迁移 catalog；局部 reroll 只用 source 保存的 resolved_ranges。
- 旧记录没有眉鼻范围时，brows/nose reroll 继续报错，可另建新样本或明确 --set。选择新默认 catalog 不等于迁移旧 profile。
- 必须选完整相关组；跨区作者自定义组若遗漏任何成员仍失败，不能修复/改写未选区域。
- 原历史 prompt 和 manifest 不覆盖。新编译器改进文案，重新编译旧 profile 不保证旧 prompt 字节一致；原文件的保存哈希仍可验证。
- `output/` 是当前编译器可重建快照，可更新；`examples/` 旧版本样本是历史记录，保留。

## 验证与限制

自动测试覆盖 27 种 omitted/off/selected 组合，exact seed 的继承/off 对照、sentinel 与明确 none、中性档与稀疏输入、新范围界限、同 seed 旧轴不变、眉鼻局部 reroll、旧范围 lineage、CLI 与 manifest 校验。最终数量及独立复核见交付说明。

英文仍以逐轴短句为主，这样更容易追踪具体控制。没有加入自然语言矛盾求解器：自由文本发型覆盖、capture 和整体印象仍需检查。高光、年龄、表情、发型会影响视觉比例；相同参数不保证同一人物、严格身份保持、精确年龄或严格几何锁定。图像冒烟测试只检验一个实例，不代表全目录校准通过。
