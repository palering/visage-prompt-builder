// Creative text shortcuts, never anatomical rules or an exhaustive identity taxonomy.
// Values remain ordinary editable schema text and use the same exact locks/pools.
export const SUBJECT_PRESETS = {
  appearance: {path:'profile.subject.appearance',label:'外貌 / 族裔描述',placeholder:'可输入任何自定义外貌描述',choices:[
    ['East Asian appearance','东亚外貌'],['Southeast Asian appearance','东南亚外貌'],['South Asian appearance','南亚外貌'],['West Asian appearance','西亚外貌'],['African appearance','非洲外貌'],['European appearance','欧洲外貌'],['mixed heritage appearance','混合背景外貌']
  ]},
  gender: {path:'profile.subject.gender_presentation',label:'性别呈现',placeholder:'如：androgynous person，或自由描述',choices:[
    ['person','不强调性别'],['woman','女性'],['man','男性'],['androgynous person','中性呈现'],['feminine person','偏女性化呈现'],['masculine person','偏男性化呈现']
  ]},
  skin: {path:'profile.skin.tone',label:'肤色',placeholder:'可输入明度、底色与自己的描述',choices:[
    ['very fair','很浅肤色'],['fair','浅肤色'],['light beige','浅米色'],['medium beige','中等米色'],['warm medium brown','暖中棕色'],['deep brown','深棕色'],['very deep brown','很深棕色'],['olive','橄榄底色']
  ]},
  shape: {path:'profile.face_geometry.face_shape',label:'脸型描述',placeholder:'如：heart-shaped，或自定义轮廓',choices:[
    ['oval','椭圆'],['round','圆形'],['heart-shaped','心形'],['square','方形'],['oblong','长形'],['diamond-shaped','菱形']
  ]}
};
export function subjectPresetValue(id,value) {
  const definition=SUBJECT_PRESETS[id];
  if(!definition) throw new Error('未知人物字段');
  return value===''?'':definition.choices.some(([preset])=>preset===value)?value:'__custom__';
}
