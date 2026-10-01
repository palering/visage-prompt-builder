# 可插拔发型库：研究与实现说明

研究日期：2026-09-30。交付 51 个可编译代表预设、19 条来源记录及分组待考证目录。范围以女性常见造型为重点，但发型几何本身不锁定性别、族群或年龄。

## 结论

应建立「少量稳定几何维度 + 可组合造型 + 有来源的命名预设」，而不是把数百个网络名词平铺成互斥发型。预设为一次性填充结构参数的配方；选择后可以解锁修改，修改后叫“自定义变体”，不继续承诺为某个时期/设计师的精确复原。

独立于骨相与面部皮相编译。头发虽不改变骨骼，却会遮住额角、耳、颧侧、下颌，改变表观脸宽/脸长、年龄感与辨识度。默认仅追加发型指令，不能让模型为发型“修正”脸型。

## 一、稳定参数

1. 状态：未指定 / 明确关闭发型描述 / 选中预设 / 自定义。未指定不是“没有头发”；明确秃发必须单独选项，不能用 off 代替。
2. 材料模式：天然头发、假发、接发/发片、既有 locs。用来判定现实可行性；图像生成模式中不应由短发限制用户做长发视觉方案。
3. 长度：头皮近贴、耳上、耳下、下巴、颈、锁骨、胸、背中、腰、超长。另记自由垂落的本体长度与盘起后的可见轮廓，两者不可混为一谈。紧卷应区分拉伸长度与视觉长度。
4. 剪裁结构：一刀齐、渐层堆叠、均匀层次、长层次、短顶长后、断连双层、非对称、侧后剃短。发尾线：平/U/V/不规则。
5. 刘海：无、齐眉钝线、碎齐眉、眉上短、帘幕、长侧分、稀疏、弧形、卷发刘海。需要长度/密度/开口，而不能只写“空气感”。
6. 分缝：中分、偏分、深侧分、锯齿、分区、无可见分缝、后梳。后梳是方向，不保证没有分缝。
7. 纹理：直、微弯、大 S 波、环卷、紧卷；编辫/拧绳/loc 结构另记，不能将 loc 当卷度。
8. 体积：总量与头顶、两侧、后枕、发梢分别控制；低/中/高只是视觉等级，不声称精确物理量。
9. 聚拢拓扑：散发、半扎、单/双马尾、单/双/多髻、纵向卷髻、编辫、环辫、贴头辫、散落多辫、抓夹。需要数量、锚点、左右对称、尾部走向。
10. 前/侧/后：正面刘海与发际线，左右鬓角/耳部，后部发髻/辫/轮廓。只写“低丸子头”不足以确保正面与背面一致。
11. 表面：哑光、自然、光泽、湿感、毛躁/碎发量。湿感不自动意味着额头有汗或头发刚洗过。
12. 发色：基色/明度/冷暖/根部/挑染/块染可单独模块；颜色不反向决定族群。
13. 饰物：发夹、发圈、簪、梳、发带、缎制头饰、花饰分别记数量、位置、材料；大体积头饰不是剪裁结构。

建议字段继续用 sidecar：hair.state、hair.preset、hair.overrides；预设列表只提供 geometry defaults。真正编译时展开几何，而不是只输出英文网红名称。

## 二、冲突与要求

### 应硬性阻止/提示修复

- hair.state=off 时不编译任何 hair 几何；其余残留字段不生效
- fringe=none 与额前齐刘海指令冲突；同一区域同一时刻不能同时无刘海和厚齐刘海
- 单髻/双髻/双尾只能选一个主要聚拢拓扑；半扎可以与下层散发并存
- 单侧耳后收发不应自动变双侧耳朵完全可见
- 密实遮眼刘海与“眼部全可见”冲突；应允许用户显式选择遮眼，但警告身份观察不充分
- 贴头直发与同一位置蓬松球形紧卷不兼容；分区混合须明写区域
- 选中历史精确模式时，现代塑料抓夹、现代刘海等修改使其降为历史灵感变体

### 应软提示，不能僵硬禁用

- 高马尾/髻需要足够可聚拢长度，或允许发片/假发/支撑；不要凭“短发”禁用视觉方案
- 大体积历史盘髻可能用髢发、垫、梳、簪与结构件，不能默认为全部真发
- 极短剃发无法同头无辅助地变成长辫；假发模式可解除现实长度要求
- 真实密度、卷曲收缩、剪裁过程属于现实咨询；这份库是生成视觉语法，不保证适合具体真人或无需造型即可达到
- 不按脸型自动改动五官，也不把某种发型与“必须白人/亚洲人/年轻女性”绑定

## 三、遮挡与身份保护

occlusion 记 forehead/temples/ears/cheeks/jaw/eyes，值 none/partial/covered/variable。它是预设视角假设下的定性元数据，不是假装测量过的百分比。

默认安全编译句：保留同一人的颅形、发际线基础位置、五官间距、下颌轮廓和身份特征；仅改变发型与发丝分布。不要为适配发型缩脸、拉长脸或改变年龄、族群。

注意：真实生发/剃发、发际线填补是额外变化；不要通过“身份保持”强迫所有新刘海显示原发际线。身份测试应同时看无遮挡参考和当前遮挡图，而不是把遮挡造成的观感差异误判为骨相真的变化。

建议 QA 三组：同一身份分别套用露额低髻、遮额波波、侧边蓬松卷发；每组正面/侧面/背面。检查下颌、眼距、鼻口比例是否保持，耳与眼遮挡是否符合，发尾/发髻数量是否跨视角自洽。

## 四、潮流与设计师的证据边界

- Butterfly：L’Oréal 专业内容在 2026-08-31 更新，保留长层与较短羽状上层；Winnipeg 的 Aveda 教育沙龙 2026-05-22 也将其列入夏季选项。这支持“当前仍被专业内容讨论”，不支持“全球第一流行”。[Hair.com](https://www.hair.com/butterfly-haircut.html) / [Aveda Winnipeg](https://avedainstitutewinnipeg.ca/school-blog/summer-hair-trends-2026-the-biggest-hair-colours-cuts-and-styles-this-season)
- Jellyfish：2025-08-14 的美国品牌编辑页面把它描述为短的圆罩上层与明显长的下层，核心是断连；与连续混合的 wolf 不能简单画等号。[L’Oréal Paris](https://www.lorealparisusa.com/beauty-magazine/hair-style/hairstyle-trends/jellyfish-haircut)
- Wolf：Sam Villa 的教程明示 shag/mullet 混合，并带有 2022 流行语境；可保留成熟网红标签，不应伪称 2026 新发明。[Sam Villa](https://www.samvilla.com/blogs/hair-tutorials/wolf-cut)
- Sally Hershberger：有示范来源，可做“柔化层次与面框”的设计师参考；非声称每个 shag 都由她发明。[ARC 示范](https://arcscissors.com/blogs/haircut-tutorials/the-shag-sally-hershbergers-4-tips)
- Sassoon Interference SS26：官方确有非对称、断连、破碎轮廓的设计语言。系列是设计系统，不是一种固定发型。预设是原创几何化解读，不标“完全复刻”。[官方系列](https://sassoon-global.com/collections/interference-collection-2026.html)
- ARIMINO AW26：官方风格书可用于日本专业趋势扩展；尚未逐张解析到精确剪裁，暂不凭宣传语制造具体“2026 日本最红款”。[A essence](https://www.arimino.co.jp/a_essence/)

Chinese/Korean social-platform popularity is not verified here. Hush、云朵烫、公主切、胎毛刘海等进入别名候选层，不展示实时热度或“全网最火”。

## 五、历史与国际范围

已收录的历史预设必须带来源等级：

- 螺髻：以故宫具体清代仕女图为入口，馆方提及唐代相似发式。不能把清代绘画直接当作无争议的唐代写实样本。[故宫](https://minghuaji.dpm.org.cn/paint/detail?id=fc57b611e45042e784f8c2cb0c4a1ad2)
- 两把头与晚清缎制头饰分开：故宫扁方说明足以支持真发两把结构与后来独立缎制构件的区别；不把所有“旗头”都当一种髻。[翠扁方](https://www.dpm.org.cn/collection/jewelry/231381.html)
- 日本岛田髻：采用英国博物馆具体作品和髻族级解释，保留画作年代不确定性；不等同全部艺伎发型。[British Museum](https://www.britishmuseum.org/collection/object/A_1913-0501-0-366)
- 韩国 얹은머리 / 쪽머리：根据国立民俗博物馆区分加髢盘绕与后期盘髻。婚姻/阶层语境保留在说明，不自动改成人物属性。[NFM](https://webzine.nfm.go.kr/2018/10/25/조선시대에도-헤어스타일-트렌드가-있었을까/)
- 罗马：具体晚弗拉维肖像参考，而非“古罗马通用发型”。[Met 肖像图录](https://resources.metmuseum.org/resources/metpublications/pdf/Roman_Portraits_Sculptures_in_Stone_and_Bronze.pdf)
- Black hairstyles：Cornrows、Bantu knots 的文化说明有 Smithsonian 支持，但 box braids、twists、locs 的当前条目主要是几何定义，不能借一个文化来源假装所有构造细节都逐项核验。[NMAAHC](https://nmaahc.si.edu/explore/stories/strands-of-inspiration)
- 印度长辫参考来自现代作品与日常梳辫语境，不能拿它证明某种古代婚礼规范。[NGMA](https://museumsofindia.gov.in/repository/record/ngma_blr-acc-no-01695-525)
- 埃及女性假发扩展暂缓：常见 British Museum EA2560 被馆方认为是男性假发，不能偷换成“埃及艳后同款”。[EA2560](https://www.britishmuseum.org/collection/object/Y_EA2560)

有意识的留白：非洲不是单一造型，东亚不只“汉服发髻”，南亚不只有新娘辫，欧洲也不能以十八世纪贵族代表所有年代与阶层。backlog 提供后续采样框架，不冒充已覆盖全球全部传统。

## 六、数据使用

hairstyle-catalog.json 的 51 条中，generic_geometry 是可用的原创视觉规范；source_backed_family 是来源支持家族轮廓；designer_reference 是带归属的参考变体；museum_supported_reference/family 是有限度的历史记录支持。所有几何描述均是生成提示词配方，不是外部来源逐字引用或唯一正统定义。

可以首屏精选 16–24 款，其余分类搜索；避免一次显示 51 个按钮。可搜索中文名、英文名、造型特征、时期/地区，但时期筛选只对具备 historicalContext 的条目生效。来源按钮显示标题/链接/观测日期/证据范围。
