# v0.7 发型来源整合与出图测试

## 范围和计数

保留 v0.6 的 51 个发型预设，增加 13 个结构预设/变体，共 **64**。这是可选配方数，不是 64 种互不重叠的基础拓扑。新增 6 个动漫参考结构配方（其中高根钻卷、双髻波浪瀑为变体）及 7 个文物轮廓配方（其中开孔双环为双环家族变体）。完整研究来源 **42 条**：30 条动漫设定参考、10 条历史发体对象、2 条明代金丝发罩配件对象。不能将参考图数当作新发型数。

新增动漫配方：twin_drills、high_twin_drills、double_bun_tails、double_bun_cascade、side_loop_tails、braided_low_updo。

新增历史配方：wuman_reference、upright_double_roll_reference、open_double_loop_reference、paired_crown_roll_reference、ear_level_double_huan_reference、offset_crown_roll_reference、flat_coiled_panju_reference。

其余动漫短发、长直发、双辫、呆毛、尖片外翘等保留为已有基础结构的参考或待组合修饰，不重复创建同义预设。偏顶高髻三件文物合并为一个证据家族。北宋袖手俑高髻仅作既有 high_bun 的对象参考。

## 名称与 API

外层仍为 appearance-v0.1，不改变 off / selected 语义。省略模块继续继承旧 enhancer 行为；off 仅抑制所属旧模块；selected 替换所属旧模块。面部参数及已有采样/迭代锁定行为不变。

preset 支持精确别名：公主切、姬发式、hime_cut → hime_geometry；双钻头 → twin_drills；乌蛮髻 → wuman_reference；双环髻 → upright_double_roll_reference；双股高髻 → paired_crown_roll_reference。详见目录 aliases。大小写、空格、近似拼写不做模糊匹配。重名、与 canonical ID 冲突的别名会拒绝。角色名不作为编译别名，只存在来源元数据中。

resolveAppearance 返回 canonical preset、requestedPreset、referenceIds、family、variantOf；原始 config 保留用户输入以便追踪。编译只读取结构几何，不写入角色姓名、脸、服装、年龄和身份。可见结构不是历史造型内部技法的复原。

```sh
npm run appearance -- --list --module hair
npm run build -- examples/hair-v0.7/base-profile.json --preset profile --enhancers --appearance examples/hair-v0.7/anime-twin-drills.appearance.json
node examples/hair-v0.7/generate.mjs
npm test
```

## 证据边界与版权

presets/hair-references.v0.7.json 保存原网页、原图 URL、版权说明、来源层级、角度、未知点、馆藏号/出处等文本；源码包不含参考缩图或本机私有图像路径。URL 不是再分发授权。官方动漫图和多数博物馆图的版权许可未经开放授权验证；请在公开使用图片前向权利人核实。Met 1979.108 条目有 Public Domain 标注，也不需要将图像嵌入源码。

乌蛮髻、双环髻、双股高髻采用国博对象名称；亚洲艺术博物馆 Dancer 只确认 two large loops，不能自动命名“双环望仙髻”或“飞天髻”。京都、故宫、Met 的偏顶髻不认作已证实的抛家、堕马、倭堕等具体古名。器物/墓葬年代只约束该参考对象，不能代表整个朝代、阶级或所有人物。

明代两件䯼髻为金丝罩：86 克侧卷型和 64 克河埒出土后收牛角型是两个配件实物，均不加入裸发发型预设，不与清代缎质头饰混同。需要配件试验时在 accessories 层明确指定罩材与底层髻，并重新评估遮挡和物理兼容性。

未见后脑或内部盘结时保持未知。预设没有为未知角度编造施工过程；出图会自行补全未知部分，那是模型选择而非史料证据。修改 overrides 后原遮挡保证失效，已有警告机制继续生效。

## 代表性出图与复现

examples/hair-v0.7/ 下保存固定 base-profile.json、两个 appearance JSON、两个完整 prompt.txt 和两个 manifest.json。generate.mjs 直接调用正式编译器，图像测试必须使用生成的完整提示词，不手工另写一版。

两个例子共同使用：25 岁成年东亚女性、漂亮且优雅的表现方向、同一面部几何、黑发、放松中性表情、85mm 眼平对称柔光、浅灰背景、头及全部发型完整入镜。动漫例测试高根粗锥双钻卷；历史例测试高耸双大环。自由文本 capture.camera_distance 明确留出顶部和两侧空间。

验收重点是可观察发型结构：双钻卷是否恰为两个连续锥形螺旋柱；双大环是否有两个清楚空心环、中央尖发体且没有变成实心丸子；头发是否完整入镜。两张图使用相同脸参数不保证像素身份一致，也不证明几何完全锁定。真实图像结果、失败和生成限制另附测试日志；不能用编译测试通过代替出图测试通过。

## 来源索引

- anime_madoka1｜短翼式高双束｜鹿目圆：[魔法少女小圆 官方角色页](https://www.madoka-magica.com/tv/archives/character/)

- anime_madoka2｜窄分束刘海长直披发｜晓美焰：[魔法少女小圆 官方角色页](https://www.madoka-magica.com/tv/archives/character/)

- anime_madoka3｜低位双螺旋钻卷｜巴麻美：[魔法少女小圆 官方角色页](https://www.madoka-magica.com/tv/archives/character/)

- anime_madoka4｜单侧耳露碎尾短鲍伯｜美树沙耶香：[魔法少女小圆 官方角色页](https://www.madoka-magica.com/tv/archives/character/)

- anime_madoka6｜高马尾加双弧顶翘｜佐仓杏子：[魔法少女小圆 官方角色页](https://www.madoka-magica.com/tv/archives/character/)

- anime_sailor0｜圆团髻连接超长双尾｜月野兔：[美少女战士 Eternal 官方角色页](https://sailormoon-movie.jp/sp/character.html)

- anime_sailor1｜尖耳髻连接短蓬双尾｜小小兔：[美少女战士 Eternal 官方角色页](https://sailormoon-movie.jp/sp/character.html)

- anime_sailor4｜长直姬式额帘与细侧束｜火野丽：[美少女战士 Eternal 官方角色页](https://sailormoon-movie.jp/sp/character.html)

- anime_sailor8｜肩长水波弧层｜海王满：[美少女战士 Eternal 官方角色页](https://sailormoon-movie.jp/sp/character.html)

- anime_sailor9｜顶端小髻加长直后幕｜冥王雪奈：[美少女战士 Eternal 官方角色页](https://sailormoon-movie.jp/sp/character.html)

- anime_sailor10｜平额帘内扣短鲍伯｜土萌萤：[美少女战士 Eternal 官方角色页](https://sailormoon-movie.jp/sp/character.html)

- anime_sailor15｜极长密波与顶端双卷髻｜妮赫蕾妮亚：[美少女战士 Eternal 官方角色页](https://sailormoon-movie.jp/sp/character.html)

- anime_sailor17｜侧环髻加双长绳尾｜赛蕾赛蕾：[美少女战士 Eternal 官方角色页](https://sailormoon-movie.jp/sp/character.html)

- anime_sailor18｜顶髻与放射垂珠复合式｜帕拉帕拉：[美少女战士 Eternal 官方角色页](https://sailormoon-movie.jp/sp/character.html)

- anime_sailor19｜三向长束球端放射式｜君君：[美少女战士 Eternal 官方角色页](https://sailormoon-movie.jp/sp/character.html)

- anime_sailor20｜高叠环髻与偏侧长尾｜贝斯贝斯：[美少女战士 Eternal 官方角色页](https://sailormoon-movie.jp/sp/character.html)

- anime_rezero4c｜遮单眼偏斜鲍伯｜雷姆：[Re:从零开始的异世界生活 官方角色页](https://re-zero-anime.jp/tv/character/)

- anime_rezero6a｜高根粗锥双钻卷｜碧翠丝：[Re:从零开始的异世界生活 官方角色页](https://re-zero-anime.jp/tv/character/)

- anime_rezero22b｜齐额帘短双麻花辫｜梅丽：[Re:从零开始的异世界生活 官方角色页](https://re-zero-anime.jp/tv/character/)

- anime_rezero26｜侧高马尾与长弧天线｜密涅瓦：[Re:从零开始的异世界生活 官方角色页](https://re-zero-anime.jp/tv/character/)

- anime_mono1｜高侧束卷尾与单根顶翘｜阿良良木火怜：[物语系列：伪物语 官方角色页](https://www.monogatari-series.com/nisemonogatari/chara/index.html)

- anime_mono2｜短圆鲍伯与长呆毛｜阿良良木月火：[物语系列：伪物语 官方角色页](https://www.monogatari-series.com/nisemonogatari/chara/index.html)

- anime_mono4｜高根细长外扬双尾｜八九寺真宵：[物语系列：伪物语 官方角色页](https://www.monogatari-series.com/nisemonogatari/chara/index.html)

- anime_mono12｜颊长鲍伯与长直鬓尾｜斧乃木余接：[物语系列：伪物语 官方角色页](https://www.monogatari-series.com/nisemonogatari/chara/index.html)

- anime_kill1｜不对称外翘尖片短发｜缠流子：[斩服少女 官方角色页](https://www.kill-la-kill.jp/character/)

- anime_satsukiface｜硬直额帘与齐切长鬓片｜鬼龙院皋月：[斩服少女 官方角色页](https://www.kill-la-kill.jp/character/02.html)

- anime_nuibody｜巨型拱根带状双钻尾｜针目缝：[斩服少女 官方角色页](https://www.kill-la-kill.jp/character/13.html)

- anime_violettv｜双侧编辫汇入低后盘髻｜薇尔莉特·伊芙加登：[紫罗兰永恒花园 官方角色页](https://tv.violet-evergarden.jp/character/)

- anime_violet2｜中分低位双辫与薄鬓丝｜伊莎贝拉·约克：[紫罗兰永恒花园 外传 官方角色页](https://violet-evergarden.jp/sidestory/)

- anime_toga｜侧部双乱髻与平额帘｜渡我被身子：[我的英雄学院 官方角色页](https://www.ytv.co.jp/heroaca/character/toga/)

- nmc-wuman｜乌蛮髻（国博定名）｜三彩釉陶女俑：[三彩釉陶女俑](https://www.chnmuseum.cn/zp/zpml/kgfjp/202111/t20211116_252272.shtml)

- nmc-yuan-panju｜中分扁圆盘髻｜彩绘盘髻女陶俑：[彩绘盘髻女陶俑](https://www.chnmuseum.cn/zp/zpml/kgfjp/202104/t20210415_249722.shtml), [国博考古发掘品目录84页](https://m.chnmuseum.cn/zp/zpml/kgdjp/index_84.html)

- nmc-double-loop｜双环髻（国博定名）｜彩绘双环髻女陶俑：[彩绘双环髻女陶俑](https://www.chnmuseum.cn/zp/zpml/csp/202209/t20220901_257159.shtml)

- nmc-double-high｜双股高髻（国博定名）｜男装女陶俑：[男装女陶俑](https://www.chnmuseum.cn/zp/zpml/kgfjp/202111/t20211116_252274.shtml)

- aam-dancer｜高耸双大环（描述性名）｜Dancer：[Dancer](https://education.asianart.org/resources/dancer-approx-618-700/)

- kyoto-GK260｜宽鬓偏顶回卷高髻（描述性名）｜Tomb Figurine of a Lady Holding a Pekinese：[Tomb Figurine of a Lady Holding a Pekinese](https://www.kyohaku.go.jp/eng/collection/meihin/touji/item02/)

- palace-00110572｜偏顶高髻（745年侍女俑）｜陶彩绘女俑：[陶彩绘女俑](https://www.dpm.org.cn/collection/sculpture/233405.html)

- henan-song-high｜北宋袖手俑高髻｜彩绘袖手石女俑：[彩绘袖手石女俑](https://www.chnmus.net/ch/collection/appraise/details.html?id=512158796610969072)

- henan-song-double｜北宋抱印俑双鬟髻｜彩绘抱印石女俑：[彩绘抱印石女俑](https://www.chnmus.net/ch/collection/appraise/details.html?id=512158796610969072)

- met-1979-108｜偏顶回卷髻（开放图前后参照）｜Standing court lady：[Standing court lady](https://www.metmuseum.org/art/collection/search/44808)

- ming-diji-curl｜金丝䯼髻：侧卷型发罩｜明金丝发罩（86克侧卷型）：[明金丝发罩（86克侧卷型）](https://www.wxmuseum.cn/News/Details/09469b9e-5a37-4501-8bbe-0cfdada8d3a2)

- ming-diji-horn｜金丝䯼髻：后收牛角型发罩｜明金丝发罩（河埒出土，64克）：[明金丝发罩（河埒出土，64克）](https://www.wxmuseum.cn/News/Details/69cc465f-b0f6-4290-9c36-01b3f22ac8de)
