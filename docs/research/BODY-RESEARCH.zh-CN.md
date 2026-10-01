# 成人体型模块：结构与文案依据

研究日期：2026-09-30。用途：为提示词编辑器提供简单、可追踪的成人体型描述，不是人体测量、医学评估或健身处方。

## 推荐范围

17 个数值控件，另加可选站姿下拉框；原理为“骨架比例 5 项 + 肌肉体量 7 项 + 外轮廓与软组织 5 项”。完整英文短句定义见 body-axes.json。不要将轮廓组全部叫作“脂肪”：腰线与腹肌可见度是表面外观，不能独自说明组织量。

数值为作者定义的 0–100 描述位置，不是百分位、人体实测长度、健康程度、体脂率或精确图像权重。建议初版使用三个明确语言档位（0–33、34–66、67–100）；同档不产生伪精度。界面可以用低/中/高按钮与滑杆同步，显示当前实际生成的短句，避免用户以为每个刻度都会改变图像。

所有控制默认不启用。缺失/关闭不输出该特征，显式启用的 50 输出中档，0 是有效低档而不是关闭。不要在切换体型预设时自动改写头部、性别、肤色、年龄或未包含的轴。

## 结构分离

- 肩架宽度是骨架跨度的外观目标，肩部肌量是三角肌体积目标。肩带包括锁骨与肩胛骨；同样宽的肩外轮廓可能来自不同结构，不能把两项互相替代。[OpenStax 8.1](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-1-the-pectoral-girdle)
- 胸廓、胸肌与乳房体量分为三个轴。胸廓是骨性结构；胸肌与乳房组织不能互换。乳房包含腺体、纤维结缔与脂肪组织，不能把乳房体量标作“胸肌”。[OpenStax 7.4](https://openstax.org/books/anatomy-and-physiology-2e/pages/7-4-the-thoracic-cage)、[NCI 乳房组织](https://www.cancer.gov/types/breast/screening/dense-breasts)
- 骨盆宽度、臀肌体量、外侧胯部软组织三个轴分别控制骨架、肌肉与表面丰满度。骨盆和周围肌群是不同结构。[OpenStax 8.3](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-3-the-pelvic-girdle-and-pelvis)、[OpenStax 11.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs)
- 上臂、肩部、胸部、背部肌肉体量分别控制，不从单个“健壮”标签推导所有部位；背部肌宽不控制含胸或挺胸。[OpenStax 11.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs)
- 腰线收束是躯干外轮廓，腹部线条是肌肉可见度，腹部柔软轮廓是软组织外观。腹壁有多层肌群，不能以腹肌线条代替腰围或诊断体脂。[OpenStax 11.4](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-4-axial-muscles-of-the-abdominal-wall-and-thorax)
- 腿长、臂长为相对躯干的视觉比例，与肌量独立。不建立具体厘米或“标准身材”映射。

来源支持解剖概念的区分，不证明这些滑杆或英文短句能精确控制生成图像，也不提供低/中/高标准。文案、档位与控件选择均为本项目作者设计。

## 站姿与拍摄

站姿使用独立枚举，不用“差 → 好”的滑杆：放松站姿 relaxed upright standing posture；对称直立 upright symmetrical standing posture；重心偏移 standing with weight resting on one leg。

全身验证建议明确头顶至脚部完整入镜、自然透视、镜头与人体保持适当距离、手臂轻离躯干与无遮挡背景。背部轴需要后视图或后侧视图才能检查；单张正面图无法充分验证背部细节。体型模块不需要复杂服装系统；验证可用简单合身日常服装，服装仍可能遮挡线条。

现有 calibration 明确为头肩肖像。启用全身拍摄时应使用独立 capture preset 或替换头肩 framing，不能把相互矛盾的构图叠加。头部 JSON 保持独立可复用；全身图里脸部像素更少，不能承诺与特写相同的细节或身份稳定性。

## 数据和编译契约

建议外层 composition v1 包含独立 head、appearance、body、capture，body 单独 version 与成年人范围。只序列化用户启用的值；关闭状态如需保留滑杆草稿，放 UI state 而非有效提示词约束。字段白名单，整数 0–100，拒绝 NaN、无限值、未知轴与错误枚举。不要以 truthiness 判断 0 是否存在。

编译时按骨架 → 肌量 → 外轮廓的固定顺序输出，保存配置版本、编译器版本、实际短句、来源目录版本与警告。只描述成人；不得把骨盆、胸部或肌肉控制与性别/性别认同绑定。词语避免“完美”“理想”“健康”“女性化”“男性化”等未经请求的评价或推断。

相邻轴可以有合理组合，不能机械判冲突，例如宽骨架与小三角肌、窄骨盆与大臀肌、轻微腰线与清晰腹部线条。腹部线条与柔软轮廓同时很高时可提示图像解释有竞争，但不要推断疾病、体脂或强行改参数。姿态、透视、衣物、灯光会影响可见轮廓。

## 最小测试集

1. 空 body 与所有开关关闭：不产生任何身体描述；头部 prompt 与 JSON 不变
2. 每轴 0/33/34/50/66/67/100：稳定且符合各自短句，缺失不同于 50，0 不被丢弃
3. 两两独立：肩架改动不改变三角肌；胸廓不改变胸肌或乳房；骨盆不改变臀肌；腰线不改变腹部线条；腿长不改变大腿肌量；背肌不改变站姿
4. 17 个控件状态 round-trip；UI 启用、按钮、滑杆、reset、导入导出一致；只 reset body 不清除头部
5. 年龄/主体约束不含未成年人；不自动写性别、不生成体脂率/厘米/BMI或健康推断
6. full-body capture 不残留 head-and-shoulders framing；旧 head-only 配置仍通过且输出不变
7. 分别用骨架、肌量、软组织单轴对照做图像冒烟测试，至少保留 seed/模型/完整配置/提示词；以观察结果记录，不将一次成功当作几何校准
8. 浏览器界面测试键盘操作、标签关联、启用状态、当前语言档显示，以及导出文件中未启用项不泄漏

## 范围边界

初版是可组合的成人外观提示词工具。它不能从照片反推出真实骨骼宽度、肌肉量或组织成分；也不保证生成图严格遵从比例。控件和来源不得用于给人物打分、身体价值排名或群体“平均体型”推断。
