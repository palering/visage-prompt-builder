// Nine bands mirror the English compiler; each numeric axis keeps its meaning.
export const FACE_AXES_ZH = {
 face_geometry:{face_length:['脸长','短','长'],face_width:['脸宽','窄','宽'],forehead_width:['额头宽度','窄','宽'],forehead_height:['额头高度','低','高'],cheekbone_width:['颧骨宽度','窄','宽'],cheekbone_height:['颧骨位置','低','高'],jaw_width:['下颌宽度','窄','宽'],jaw_angle:['下颌转角','柔和圆润','棱角分明','柔和清晰'],chin_width:['下巴宽度','窄','宽'],chin_length:['下巴长度','短','长'],chin_projection:['下巴前突','后缩','前突']},
 soft_tissue:{upper_medial_cheek_fullness:['上内侧面颊体积','清瘦','饱满'],lateral_cheek_fullness:['外侧面颊体积','少','饱满'],cheek_fullness:['面颊体积','清瘦','饱满'],midface_length:['中面长度','短','长'],under_eye_volume:['眼下体积','凹陷','饱满'],nasolabial_definition:['鼻唇沟显著度','柔和','明显','轻微'],facial_softness:['面部软组织','清瘦清晰','柔软圆润'],temple_fullness:['太阳穴体积','凹陷','饱满']},
 eyes:{eye_size:['眼睛大小','小','大','中等'],eye_length:['水平眼长','短','长'],eye_roundness:['眼裂形状','窄','圆'],eye_spacing:['眼距','近','远'],eye_tilt:['外眼角方向','下垂','上扬','水平'],eye_socket_depth:['眼窝深度','浅','深']},
 eyebrows:{brow_thickness:['眉毛粗细','细','粗','中等'],brow_height:['眉毛位置','低','高'],brow_arch:['眉形','平直','弧形','轻弧形'],brow_length:['眉毛长度','短','长'],brow_density:['眉毛浓密度','稀疏','浓密','中等']},
 nose:{bridge_height:['鼻梁高度','低','高'],bridge_width:['鼻梁宽度','窄','宽'],nose_length:['鼻子长度','短','长'],nose_projection:['鼻子前突','轻微','明显'],tip_size:['鼻尖大小','小','大','中等'],tip_roundness:['鼻尖形状','清晰','圆润','柔和圆润'],tip_rotation:['鼻尖方向','下垂','上翘','中性'],alar_width:['鼻翼宽度','窄','宽'],nostril_visibility:['鼻孔显露程度','低','高']},
 mouth:{mouth_width:['嘴宽','窄','宽'],upper_lip_fullness:['上唇丰满度','薄','丰满','适中'],lower_lip_fullness:['下唇丰满度','薄','丰满','适中'],cupid_bow_definition:['唇峰清晰度','柔和','鲜明','适中'],mouth_corner_direction:['嘴角方向','下垂','上扬','中性'],philtrum_length:['人中长度','短','长']},
 skin:{translucency:['皮肤通透度','低','高'],blemish_visibility:['可见皮肤变化','少','多'],freckle_visibility:['雀斑显著度','少','明显']},
 hair:{volume:['发量','低','高']},
 expression:{eye_openness:['眼睛开合','放松','睁开','自然睁开'],mouth_relaxation:['嘴部状态','紧绷','放松','自然放松']}
};
export function describeFaceValueChinese(section,key,value) {
 const axis=FACE_AXES_ZH[section]?.[key];
 if(!axis || !Number.isFinite(value) || value<0 || value>100) throw new Error('Invalid face axis/value.');
 const [noun,low,high,neutral='适中']=axis;
 const adjective=value<=14?'极为'+low:value<=29?'明显偏'+low:value<=42?'中度偏'+low:value<=47?'略偏'+low:value<=52?neutral:value<=57?'略偏'+high:value<=70?'中度偏'+high:value<=85?'明显偏'+high:'极为'+high;
 return `${noun}：${adjective}`;
}
export const BODY_AXES_ZH = {
 shoulder_span:['肩架窄','肩架宽度适中','肩架宽'],ribcage_breadth:['胸廓窄','胸廓宽度适中','胸廓宽'],pelvic_span:['骨盆架窄','骨盆架宽度适中','骨盆架宽'],leg_length:['腿相对较短','腿相对躯干的长度适中','腿相对较长'],arm_length:['手臂相对较短','手臂相对躯干的长度适中','手臂相对较长'],deltoid_volume:['三角肌体量小','三角肌体量适中','三角肌体量饱满'],pectoral_volume:['胸肌体量小','胸肌体量适中','胸肌体量大'],lat_breadth:['背部外侧肌肉宽度小','背部外侧肌肉宽度适中','背阔肌轮廓宽'],upper_arm_volume:['上臂肌肉体量小','上臂肌肉体量适中','上臂肌肉体量大'],thigh_volume:['大腿肌肉体量小','大腿肌肉体量适中','大腿肌肉体量大'],calf_volume:['小腿肌肉体量小','小腿肌肉体量适中','小腿肌肉体量大'],gluteal_volume:['臀肌体量小','臀肌体量适中','臀肌体量大'],waist_taper:['腰部轮廓较直','腰部轮廓轻柔收束','腰部轮廓明显收束'],abdominal_definition:['腹部肌肉轮廓轻微','腹部肌肉线条柔和可见','腹部肌肉线条清晰'],breast_volume:['乳房体量小','乳房体量适中','乳房体量较丰满'],abdominal_softness:['腹部软组织丰满度低','腹部软组织丰满度适中','腹部软组织丰满度明显'],hip_fullness:['胯部外侧软组织丰满度低','胯部外侧软组织丰满度适中','胯部外侧软组织轮廓较丰满']
};
export function describeBodyValueChinese(id,value) {
 if(!BODY_AXES_ZH[id] || !Number.isFinite(value) || value<0 || value>100) throw new Error('Invalid body axis/value.');
 return BODY_AXES_ZH[id][value<34?0:value>66?2:1];
}
