# 头部外观模块 v0.6：使用、边界与扩展

## 本轮交付

保留 v0.5 脸部结构 schema、采样范围与版本迭代。新增独立 `appearance-v0.1` 配置，支持发型、分区彩妆、成人表观年龄、可见表情。没有 UI、图像 API、发布或部署。

目录含 51 个发型预设和 21 个彩妆预设，覆盖现代剪裁、纹理与盘编发、具日期的潮流/设计师参考、限定地域和时期的历史参考。数量不等于验证深度：通用几何是作者规格；来源支持的是技法或对象，组合配方仍为设计解释。见 `presets/appearance.v0.1.json` 的 evidenceStatus/sourceIds/context 和 `docs/research/`，并非完整发型史、潮流排行榜或模型实测保证。

## 快速使用

```bash
npm run appearance -- --list
npm run appearance -- --list --module hair
npm run build -- examples/appearance/base-profile.json --preset profile --appearance examples/appearance/hair-only.json
npm run sample -- --archetype beautiful --seed head-demo --appearance examples/appearance/makeup-only.json --out-dir samples/head-demo
npm run batch -- --archetype beautiful --count 4 --seed head-demo --appearance examples/appearance/hair-only.json --out-dir drafts/head-batch
npm run iterate -- --input drafts/head-batch/candidate-001/profile.json --appearance examples/appearance/makeup-only.json --out-dir drafts/head-makeup
npm run compare -- --before drafts/head-batch/candidate-001/profile.json --after drafts/head-makeup/profile.json
```

build 继续使用显式编译选项，不自动读取同目录 manifest。重编译保存样本时使用它的 `compiler_options`：例如 `--preset profile --enhancers --appearance samples/head-demo/appearance.json`；本示例的 enhancers=false 则不加 `--enhancers`。JS API 可直接 `compileFacePrompt(profile, manifest.compiler_options)`。采样/批量/迭代均保存 appearance.json；不要编辑已保存版本，用新配置创建分支。

## 配置与优先级

```json
{
  "version": "appearance-v0.1",
  "hair": {"state": "selected", "preset": "blunt_bob", "overrides": {"color": "dark brown"}},
  "makeup": {"state": "selected", "preset": "makeup_satin_medium", "overrides": {"lipFinish": "muted rose satin", "lipBoundary": "follow the natural lip edge"}},
  "apparentAge": {"state": "selected", "years": 35},
  "expression": {"state": "selected", "preset": "slight_smile"}
}
```

1. 整个配置缺省：与旧版行为相同；是否输出旧 hair/makeup/expression 取决于 enhancers
2. 单个模块缺省：不干预对应旧层，即隐式 inherit；没有 `state:inherit` 写法
3. `state:off`：抑制该模块对应的旧 enhancer 块，不发新描述；不是“秃头”“明确素颜”或清除模型先验。off 只能有 state，不可带被忽略的 preset/overrides。年龄 off 使用 adult 兜底
4. `state:selected`：选定预设替换对应旧块，再按字段应用 overrides。不会重复输出旧发型和新发型；其余旧层保持旧规则。区域预设如 `eye_short_wing` 是整妆模块的新内容，不继承旧妆的其它字段；要叠加细节请写 overrides
5. 明确无彩妆：选 `makeup_bare`；它与关闭模块不同。`none` 字符串用于某一槽明确没有该项；缺省槽表示不指定
6. `--appearance file` 在 iterate 中替换完整外观配置，不做隐式深度合并；要保留的模块必须带上。仅改变外观无需伪造 --set
7. 年龄 selected 只允许整数 18–90，编译为 approximately；不是精确年龄估计或生成保证，不附加灰发、皱纹数量、悲伤、性别或族裔变化
8. 表情提供 relaxed_neutral / slight_smile / broad_smile / frown / surprise，可见眉、眼睑、嘴唇、面颊动作的作者描述，不推断人格或真实情绪，未声称标准 FACS AU 验证

## 拍摄与旧 enhancer 的交互

`calibration` 的固定中性拍摄要求与任何 selected 模块冲突，明确报错；请选 profile 或 none。全 off 可以用 calibration，但 calibration 仍输出自己的“头发不遮轮廓、minimal makeup、neutral expression”等拍摄约束。off 只关闭旧外观块，不覆盖 calibration。

`profile` 的 capture 和旧 overall_impression 是自由文本，系统无法穷尽语义冲突。解析结果会提醒人工复查。做模块对照请用 `enhancers:false`（CLI 不加 --enhancers），同一明确中性 capture。旧 overall_impression/subject.appearance/skin 可能继续影响观感；模块关闭不保证移除这些偏好或模型先验。

## 结构不改写，视觉不等于锁死

- 软件可验证：发型、彩妆、年龄、表情不写 face_geometry、soft_tissue、eyes、eyebrows、nose、mouth 等结构字段；同 seed 基础随机抽样不变；模块配置、解析详情、目录与编译依赖哈希写入 manifest
- 无法据此保证：生成图片是同一人、所有关键点不动、年龄精确、模型严格执行发型/眼线细节
- 发型改变外轮廓和遮挡，因此会改变额头、太阳穴、面颊、下颌的可见宽度
- 彩妆用描线、色彩、阴影与反射改变眉眼鼻唇边界和年龄观感；不是骨骼编辑。中遮盖不会自动白化肤色；高光不代表更年轻
- 表情改变肌肉与可见几何；笑会抬面颊、缩眼裂，皱眉会改变眉眼间距。结构参数应视作静态底板，而非每个表情下的像素位置
- 年龄涉及皮肤/软组织观感，无每岁→固定皱纹函数；不同底脸的妆容年龄效应方向也未必一致

每个模块有 impact、warnings、来源/证据状态。发型还记录定性 occlusion、requirements、materialModes 与历史文化上下文。用户覆盖任意几何字段后，occlusion 会置空并标记需重检；来源依然说明原预设，不背书修改后的配方。

## 兼容性边界

预设按整体作者几何提供兼容的长度、剪裁、刘海、分缝、纹理、体积、前侧后部、收束与配件。发长与盘起后的可见长度不同；假发/发片可改变真实长度约束。支持配件从预设一起编译。

overrides 是受长度限制的自由文本，只允许已知字段；单值槽始终只有一个最后值。它不是沙龙物理求解器，也没有自然语言矛盾自动修复：例如“露额头”与“遮全额刘海”的跨字段组合需人工调整。修改历史预设、加入现代配件后应称历史启发式变体，不称考据复原。后续可加入枚举式几何编辑器与受约束组合规则，不以眼前启发式强改锁定字段。

发型 overrides：color/length/cut/fringe/part/texture/volume/arrangement/front/sides/back 为短字符串，accessories 为短字符串数组。妆容 overrides：coverage/finish/browRendering/eyelinerGeometry/lashes/shadowPlacement/blushPlacement/contour/highlight/lipBoundary/lipFinish/palette/ornament。未知键、未知预设、错版本、无效年龄、非对象等直接失败。

## 版本与对照

迭代只改模块时 profile 完全不变，manifest.appearance_diff 与 compiler_options 记录变化；compare 同时显示结构和编译配置差异。后续局部五官迭代继承外观配置，使用新目录，不覆盖历史。source_compiler_options 保留原配置。采样源 manifest 的编译配置必须与其已哈希 profile 元数据一致，防止旁路篡改来源选项。

`examples/appearance/` 保留同一成人女性底板的 modules-off、hair-only、makeup-only 历史提示词；旧 hair-only 显式关闭其他模块，适合隔离对照。新增 hair-inherit.json 仅选发型，其他模块继承，不用于隔离对照。它们是视觉冒烟测试输入，不声称全目录已经通过实图实验。生成结果应记录模型/时间/参考图使用方式，比较目标项变化与非目标项漂移，避免只凭一张图片断言身份锁定。

## 基础脸部待办保留

v0.8 更新见 `HEAD-PIPELINE-v0.8.zh-CN.md`；以下保留未完成的实图研究任务：

- v0.8 已增加眉部/鼻部的作者范围与区内分组；旧记录不回填，仍以自身保存的范围为准
- 各 archetype、数值分档和美感预设的实图校准；作者艺术假设不能包装成人体测量事实
- compiler 的结构英文从逐轴短语改进为更自然的连贯语句，同时保存轴向意义和中性参数
- 眼、鼻、眉等模块跨底脸的可辨识度与重复性，建立较大样本而非单图判断
- 历史发式、地域妆、网络趋势继续逐项来源核验，明确来源日期、地域、人物/角色，不靠名称扩充百科
