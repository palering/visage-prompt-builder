# v0.5：批量候选 → 选中 → 局部重抽／手动改值 → 新版本

这是参数 JSON 和提示词工作流，不会调用图片 API。先生成 3–4 组提示词，在外部图片工具试图后，把喜欢的候选文件交回本工具继续调整。参数保留不等于图片人物身份、像素或构图不变；不同 seed 也可能落到同一句提示词。

## 三分钟上手

需要 Node.js 18+，没有运行时依赖。在项目根目录运行：

```bash
# 1. 一次生成四个候选；索引元数据从 0 开始，目录编号从 001 开始
npm run batch -- --archetype beautiful,elegant --count 4 --seed demo-01 --out-dir drafts/batch-01

# 2. 假设选中第二个，锁住其他部分，只重抽眼部数值
npm run iterate -- --input drafts/batch-01/candidate-002/profile.json --regions eyes --seed eyes-02 --out-dir drafts/eyes-v2

# 3. 再手动改眼睛大小及眉弓；所有其他值保持不变
npm run iterate -- --input drafts/eyes-v2/profile.json --set eyes.eye_size=62 --set eyebrows.brow_arch=60 --seed edit-03 --out-dir drafts/edit-v3

# 4. 看本轮与上一轮的变化
npm run compare -- --before drafts/eyes-v2/profile.json --after drafts/edit-v3/profile.json

# 5. 不喜欢第三版？直接重新使用第二版 prompt.txt/profile.json。
#    或从第二版另开分支，不会覆盖第三版
npm run iterate -- --input drafts/eyes-v2/profile.json --set eyes.eye_size=48 --seed branch-04 --out-dir drafts/branch-v4
```

选中就是选择该目录的 `profile.json`，没有额外的“选中状态”。文件都在原处，可随时回用。输出目录必须是全新目录，不支持 `--force`，也不能建在已有版本／批次目录里面；已有文件、空目录、符号链接及符号链接祖先均拒绝写入。

## 能改什么

- `--regions eyes`：重抽已配置的眼部数值；不会改变眉毛、鼻子、嘴唇、脸型、肤色、外貌描述、妆发或拍摄设置
- `--regions outline,cheeks,lips,expression`：分别对应 face_geometry、soft_tissue、mouth、expression；只重抽源档记录的范围内字段，不补齐区域内其他缺失字段
- `brows`、`nose`、`styling` 是可识别区域名，但默认目录没有这些重抽范围，会明确报错。可用手动值，例如 `--set eyebrows.brow_arch=60`、`--set nose.tip_size=45`
- 同一次可“眼部重抽 + 手动眉毛编辑”。手动编辑区域之外的字段必须逐项明确给出，会记录到 diff；同一字段重复编辑或同时重抽并手动编辑会报错
- 数值轴一般为 0–100；拍摄角度为 -180–180。数字不要传字符串、布尔或 null；不自动钳制手动输入，不支持用 null 删除字段
- 字符串必须是 JSON 字符串，例如 Bash 中使用 `--set 'expression.expression="calm neutral"'`。数组可整体赋值，不接受数组下标、对象路径或元数据修改

字段具体含义见 `schemas/face_schema_v0.1.json` 与 v0.2 说明。`subject.appearance`、局部双颊和轮廓字段仅限 face-v0.2；不会自动迁移老文件。

## 编译设置不会被悄悄改变

对本工具保存的版本，自动读取旁边的 `manifest.json`；初代 v0.4 样本读取 metadata.sampling.compiler_options。`preset: none` 和 `enhancers: false` 都会原样保留。

无这些元数据的独立 JSON，明确默认 `none + false`，避免引入额外拍摄和妆发内容。需要改变时同时指定：

```bash
npm run iterate -- --input standalone.json --set eyes.eye_size=55 --preset profile --enhancers true --out-dir drafts/custom-v1
```

calibration 不允许 enhancers=true。重新编译保存版本时，请使用 manifest 中的选项；普通 build 命令的默认值与此处不同。

## 每个版本包含什么

- `profile.json`：有效、可独立编译的原始参数。除明确修改的字段外，所有内容保持不变，包括缺失字段与元数据；旧 sampling 元数据记录的是最初来源，不冒充本轮结果
- `prompt.txt`：按本轮保存的编译选项生成
- `manifest.json`：本轮 seed、算法／编译器指纹、选区／手动值、父内容哈希／父版本 ID、编译选项、精确范围和机器可读 diff。当前版本来源以该 sidecar 为准
- `source-profile.json`：完整父参数快照，不需要依赖外部源文件继续存在
- `diff.txt`：人可读改动。没有变化会明确说明；manifest 的 prompt_changed 可区分“参数变化但文本落到同一分档”

每版只保存一个父快照，不把上一版整个 manifest 再嵌套进去。选择历史 profile 可重新使用或分支；不是自动管理的数据库，也不会自动回滚外部图片工具。

## 重抽边界与复现

批次 count 为整数 1–16，默认 4。给定同一主 seed、目录与算法，候选索引稳定；前三个候选不会因 count 从 3 改为 4 而改变。派生 seed 可单独重播初代 `npm run sample`。遗漏 seed 会生成并保存。独特参数数与独特提示词数分别报告，不承诺每个候选视觉不同。

局部重抽沿用选中档的 resolved_ranges，不重新选脸型家族、不重选外貌或表演方向。一个已配置 correlation group 必须整体选中，跨选区的自定义组会报错，不会顺带改锁定字段。迭代器使用同组共享分位数、三角分布和两位小数（极细端点仍保持范围），因此组内一起变化；这不同于 v0.4 批量采样的共享＋局部噪声算法。手动值可以超出艺术采样范围，只要仍在 schema 的合法范围内；以后重抽该字段会回到原有艺术范围。

这是作者设定的艺术范围与组内相关性，不是统计条件分布，不验证真实解剖合理性，也不保证人与脸的身份一致。改 cheek_fullness 时，如果已有 v0.2 区域脸颊字段，编译器仍优先局部字段，旧值可能不影响提示词，工具会诚实记录 prompt_changed=false。

种子仅在相同代码／目录／选项下复现。源快照、resolved_ranges、fingerprint 和原始 prompt 都保留用于核对。自定义或将来修改目录后，不能只凭一个 seed 宣称重现旧结果。

## 已提供的合成示例

`examples/iterations/` 包含四候选、第二候选眼部重抽、手动眼睛／眉毛编辑、从眼部版本分支，以及验证记录。全部为合成成年角色参数，无真人图片或私人信息。
