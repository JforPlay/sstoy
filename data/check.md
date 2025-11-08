GameEnum.elementType =
{
    INHERIT                                                      =   0 ; --- 继承属性
    WE                                                           =   1 ; --- 水
    FE                                                           =   2 ; --- 火
    SE                                                           =   3 ; --- 地
    AE                                                           =   4 ; --- 风
    LE                                                           =   5 ; --- 光
    DE                                                           =   6 ; --- 暗
    NONE                                                         =   7 ; --- 无
}


GameEnum.itemRarity =
{
    SSR                                                          =   1 ; --- 史诗（彩）
    SR                                                           =   2 ; --- 精英（橙）
    R                                                            =   3 ; --- 稀有（蓝）
    M                                                            =   4 ; --- 优秀（绿）
    N                                                            =   5 ; --- 普通（白）
}

GameEnum.effectAttributeType =
{
    NONE                                                         =   0 ; --- 无
    ATK                                                          =   1 ; --- 攻击力
    DEF                                                          =   2 ; --- 防御力
    MAXHP                                                        =   3 ; --- 生命上限
    HITRATE                                                      =   4 ; --- 命中
    EVD                                                          =   5 ; --- 回避
    CRITRATE                                                     =   6 ; --- 暴击
    CRITRESIST                                                   =   7 ; --- 暴击抵抗
    CRITPOWER_P                                                  =   8 ; --- 暴击伤害
    PENETRATE                                                    =   9 ; --- 防御穿透
    DEF_IGNORE                                                   =  10 ; --- 无视防御
    WER                                                          =  11 ; --- 水系抗性
    FER                                                          =  12 ; --- 火系抗性
    SER                                                          =  13 ; --- 地系抗性
    AER                                                          =  14 ; --- 风系抗性
    LER                                                          =  15 ; --- 光系抗性
    DER                                                          =  16 ; --- 暗系抗性
    WEE                                                          =  17 ; --- 水系伤害
    FEE                                                          =  18 ; --- 火系伤害
    SEE                                                          =  19 ; --- 地系伤害
    AEE                                                          =  20 ; --- 风系伤害
    LEE                                                          =  21 ; --- 光系伤害
    DEE                                                          =  22 ; --- 暗系伤害
    WEP                                                          =  23 ; --- 水系穿透
    FEP                                                          =  24 ; --- 火系穿透
    SEP                                                          =  25 ; --- 地系穿透
    AEP                                                          =  26 ; --- 风系穿透
    LEP                                                          =  27 ; --- 光系穿透
    DEP                                                          =  28 ; --- 暗系穿透
    WEI                                                          =  29 ; --- 无视水系伤害
    FEI                                                          =  30 ; --- 无视火系伤害
    SEI                                                          =  31 ; --- 无视地系伤害
    AEI                                                          =  32 ; --- 无视风系伤害
    LEI                                                          =  33 ; --- 无视光系伤害
    DEI                                                          =  34 ; --- 无视暗系伤害
    WEERCD                                                       =  35 ; --- 受到水系伤害
    FEERCD                                                       =  36 ; --- 受到火系伤害
    SEERCD                                                       =  37 ; --- 受到地系伤害
    AEERCD                                                       =  38 ; --- 受到风系伤害
    LEERCD                                                       =  39 ; --- 受到光系伤害
    DEERCD                                                       =  40 ; --- 受到暗系伤害
    WEIGHT                                                       =  41 ; --- 重量
    TOUGHNESS_MAX                                                =  42 ; --- 最大韧性
    TOUGHNESS_DAMAGE_ADJUST                                      =  43 ; --- 破韧效率
    SHIELD_MAX                                                   =  44 ; --- 护盾上限
    MOVESPEED                                                    =  46 ; --- 移动速度
    ATKSPD_P                                                     =  47 ; --- 攻击速度
    INTENSITY                                                    =  48 ; --- 强度
    GENDMG                                                       =  49 ; --- 造成伤害
    DMGPLUS                                                      =  50 ; --- 伤害值
    FINALDMG                                                     =  51 ; --- 最终伤害
    FINALDMGPLUS                                                 =  52 ; --- 最终伤害值
    GENDMGRCD                                                    =  53 ; --- 受到所有伤害
    DMGPLUSRCD                                                   =  54 ; --- 受到伤害
    SUPPRESS                                                     =  55 ; --- 弱点压制
    NORMALDMG                                                    =  56 ; --- 普攻伤害
    SKILLDMG                                                     =  57 ; --- 技能伤害
    ULTRADMG                                                     =  58 ; --- 绝招伤害
    OTHERDMG                                                     =  59 ; --- 其他伤害
    RCDNORMALDMG                                                 =  60 ; --- 受到普攻伤害
    RCDSKILLDMG                                                  =  61 ; --- 受到技能伤害
    RCDULTRADMG                                                  =  62 ; --- 受到绝招伤害
    RCDOTHERDMG                                                  =  63 ; --- 受到其他伤害
    MARKDMG                                                      =  64 ; --- 印记伤害
    RCDMARKDMG                                                   =  65 ; --- 受到印记伤害
    SUMMONDMG                                                    =  66 ; --- 仆从伤害
    RCDSUMMONDMG                                                 =  67 ; --- 受到仆从伤害
    PROJECTILEDMG                                                =  68 ; --- 衍生物伤害
    RCDPROJECTILEDMG                                             =  69 ; --- 受到衍生物伤害
    NORMALCRITRATE                                               =  70 ; --- 普攻暴击
    SKILLCRITRATE                                                =  71 ; --- 技能暴击
    ULTRACRITRATE                                                =  72 ; --- 绝招暴击
    MARKCRITRATE                                                 =  73 ; --- 印记暴击
    SUMMONCRITRATE                                               =  74 ; --- 仆从暴击
    PROJECTILECRITRATE                                           =  75 ; --- 衍生物暴击
    OTHERCRITRATE                                                =  76 ; --- 其他暴击
    NORMALCRITPOWER                                              =  77 ; --- 普攻暴击伤害
    SKILLCRITPOWER                                               =  78 ; --- 技能暴击伤害
    ULTRACRITPOWER                                               =  79 ; --- 绝招暴击伤害
    MARKCRITPOWER                                                =  80 ; --- 印记暴击伤害
    SUMMONCRITPOWER                                              =  81 ; --- 仆从暴击伤害
    PROJECTILECRITPOWER                                          =  82 ; --- 衍生物暴击伤害
    OTHERCRITPOWER                                               =  83 ; --- 其他暴击伤害
    ENERGY_MAX                                                   =  84 ; --- 能量上限
    SKILL_INTENSITY                                              =  85 ; --- 技能强度
    TOUGHNESS_BROKEN_DMG                                         =  86 ; --- 破韧专属易伤
    ADD_SHIELD_STRENGTHEN                                        =  87 ; --- 护盾强效
    BE_ADD_SHIELD_STRENGTHEN                                     =  88 ; --- 受护盾效率
    MAX                                                          =  89 ; --- 最大效果数量
}

GameEnum.takeEffect =
{
    NONE                                                         =   0 ; --- 无
    DEFAULT                                                      =   1 ; --- 默认
    HEALTHUP                                                     =   2 ; --- 生命高于
    HEALTHDOWN                                                   =   3 ; --- 生命低于
    CARRYBUFFID                                                  =   4 ; --- 携带IDBuff
    CARRYBUFFGROUP                                               =   5 ; --- 携带组Buff
    CARRYBUFFIDENTIFYING                                         =   6 ; --- 携带标识Buff
    SKILLSLOTTYPE                                                =   7 ; --- 指定技能槽位
    HITELEMENTTYPE                                               =   8 ; --- 指定伤害元素类型
    DISTANCETYPE                                                 =   9 ; --- 指定攻击类型
    ACTORELEMENTTYPE                                             =  10 ; --- 指定角色元素类型
    CERTAINBUFFID                                                =  11 ; --- 指定BUFFID
    CERTAINBUFFGROUPID                                           =  12 ; --- 指定BUFF组ID
    CERTAINBUFFTAG                                               =  13 ; --- 指定BUFF标识
    CERTAINSHIELDID                                              =  14 ; --- 指定护盾ID
    NEARBY_ACTOR_LARGE_OR_EQUAL                                  =  15 ; --- 附近人数多于
    NEARBY_ACTOR_LESS_OR_EQUAL                                   =  16 ; --- 附近人数少于
    CERTAIN_SKILL_ID                                             =  17 ; --- 指定技能ID
    HAVE_SHIELD                                                  =  18 ; --- 有护盾
    NO_SHIELD                                                    =  19 ; --- 无护盾
    LEAVE_STAGE                                                  =  20 ; --- 不在场上
    HIT_TARGET_MOREOREQUAL_THAN                                  =  21 ; --- 同时命中敌人多于
    HIT_TARGET_LESSOREQUAL_THAN                                  =  22 ; --- 同时命中敌人少于
     BUFF_NUM                                                    =  23 ; --- BUFF叠加层数
     PROBOBILITY_UP                                              =  24 ; --- 概率高于 
    CERTAIN_LEVEL_TYPE                                           =  25 ; --- 指定关卡类型
    CERTAIN_EFFECT_ID                                            =  26 ; --- 指定效果ID
    CERTAIN_EFFECT_TAG                                           =  27 ; --- 指定效果TAG
    CERTAIN_MONSTER_EPICTYPE                                     =  28 ; --- 指定怪物阶层
    TIME_INTERVAL                                                =  29 ; --- 间隔时间
    CHARACTER_JOBCLASS                                           =  30 ; --- 指定职业
    ROGUELIKE_LEVELSTYLE                                         =  31 ; --- 指定关卡主题
    CERTAIN_MONSTER_TAG                                          =  32 ; --- 指定怪物标签
    TARGET_CONTAIN_TAG                                           =  33 ; --- 目标包含指定标签
    DAMAGE_CONTAIN_TAG                                           =  34 ; --- 伤害包含指定标签
    DISTANCE_LESSOREQUAL_THAN                                    =  35 ; --- 与目标距离小于
    DISTANCE_MOREOREQUAL_THAN                                    =  36 ; --- 与目标距离大于
    CERTAIN_FACTION_TYPE                                         =  37 ; --- 指定阵营类型
    IN_FORWARDAREA                                               =  38 ; --- 目标处于自己前方扇形范围内
    CERTAIN_HITDAMAGEID                                          =  39 ; --- 指定伤害ID
    HAVE_FRIENDLY_SUMMONS                                        =  40 ; --- 场上有友方召唤物
    SELF_BE_MIANCONTROL                                          =  41 ; --- 自己为主控角色
    SELF_BE_ASSISTANT                                            =  42 ; --- 自己为支援角色
    CERTAIN_TYPE_ASSISTANT_IN_BATTLE                             =  43 ; --- 指定元素类型的支援角色驻场
    CERTAIN_MARK_ELMENT_TYPE                                     =  44 ; --- 指定印记元素类型
    ULTIMATE_ENERGY_MOREOREQUAL_THAN                             =  45 ; --- 大招能量百分比大于等于
    SELF_HP_PERCENT_MOREOREQUAL_THAN                             =  46 ; --- 自己血量百分比高于目标
    ULTIMATE_ENERGY_LESSOREQUAL_THAN                             =  47 ; --- 大招能量百分比小于等于
    IS_TOUGHNESS_BROKEN                                          =  48 ; --- 是否处于破韧状态
    DAMAGE_NOT_NORMAL                                            =  49 ; --- 非普攻伤害
    WEAKELEMENTTYPE                                              =  50 ; --- 指定目标弱点元素类型
    CERTAIN_MARK_TYPE                                            =  51 ; --- 指定印记类型
}

GameEnum.effectType =
{
    STATE_CAHNGE                                                 =   1 ; --- 状态属性修改
    CURRENTCD                                                    =   2 ; --- 技能冷却当前时间
    CD                                                           =   3 ; --- 技能冷却最大值
    ADDBUFF                                                      =   6 ; --- 添加Buff
    ADD_SKILL_LV                                                 =   7 ; --- 提升技能等级
    SET_SKILL_LV                                                 =   8 ; --- 提升技能等级至
    IMM_BUFF                                                     =   9 ; --- 免疫Buff
    ADDSKILLAMOUNT                                               =  10 ; --- 增加技能使用层数
    RESUMSKILLAMOUNT                                             =  11 ; --- 恢复技能最大使用层数
    ATTR_FIX                                                     =  12 ; --- 属性修改
    REMOVE_BUFF                                                  =  13 ; --- 移除BUFF
    EFFECT_CD_FIX                                                =  14 ; --- 效果当前冷却
    EFFECT_MAX_CD_FIX                                            =  15 ; --- 效果最大冷却
    AMEND_NO_COST                                                =  16 ; --- 攻击不消耗子弹
    DAMAGE_IMM_ACC                                               =  17 ; --- 免疫次数伤害
    EFFECT_MUL                                                   =  18 ; --- 同时触发效果
    EFFECT_HP_RECOVRY                                            =  19 ; --- 回复生命值
    KILL_IMMEDIATELY                                             =  21 ; --- 即死
    ADD_BUFF_DURATION_EXISTING                                   =  22 ; --- 延长已有Buff持续时长
    HIT_ELEMENT_TYPE_EXTEND                                      =  23 ; --- 伤害元素类型扩展
    CHANGE_EFFECT_RATE                                           =  24 ; --- 效果起效几率
    ADD_TAG                                                      =  25 ; --- 添加标签
    EFFECT_HP_REVERTTO                                           =  27 ; --- 恢复生命值至
    EFFECT_HP_ABSORB                                             =  28 ; --- 生命吸取
    CHANGE_BUFF_LAMINATEDNUM                                     =  29 ; --- 调整Buff单实例叠加上限
    CHANGE_BUFF_TIME                                             =  30 ; --- 调整Buff持续时间
    EFFECT_REVIVE                                                =  31 ; --- 复活目标
    EFFECT_POSTREVIVE                                            =  32 ; --- 复活效果
    SPECIAL_ATTR_FIX                                             =  34 ; --- 特殊属性修改
    AMMO_FIX                                                     =  35 ; --- 弹夹修正
    MONSTER_ATTR_FIX                                             =  36 ; --- 怪物属性修改
    PLAYER_ATTR_FIX                                              =  37 ; --- 玩家属性修改
    IMMUNE_DEAD                                                  =  38 ; --- 免疫死亡
    ENTER_TRANSPARENT                                            =  39 ; --- 进入遮蔽表现
    UNABLE_RECOVER_ENERGY                                        =  40 ; --- 无法恢复能量
    CLEAR_MONSTER_AI_BRANCH_CD                                   =  41 ; --- 清除怪物分支cd
    ADD_SHIELD                                                   =  42 ; --- 添加护盾
    REDUCE_HP_BY_CURRENTHP                                       =  43 ; --- 根据当前生命扣除血量
    REDUCE_HP_BY_MAXHP                                           =  44 ; --- 根据最大生命扣除血量
    HITTED_ADDITIONAL_ATTR_FIX                                   =  45 ; --- 击中时附加属性修改
    ATTR_ASSIGNMENT                                              =  46 ; --- 属性赋予
    CAST_AREAEFFECT                                              =  47 ; --- 释放区域效果
    PASSIVE_SKILL                                                =  48 ; --- 释放被动技能
    IMM_CERTAIN_HITDAMAGEID                                      =  49 ; --- 免疫指定伤害id的伤害
    STATE_AMOUNT                                                 =  50 ; --- 特殊状态属性生效次数
    DROP_ITEM_PICKUP_RANGE_FIX                                   =  51 ; --- 掉落物拾取半径修正
}

GameEnum.stateAttributeType =
{
    NONE                                                         =   0 ; --- 无
    CHAOS                                                        =   1 ; --- 混乱
    CHAOS_WEAKENED                                               =   2 ; --- 次级混乱
    SUA                                                          =   3 ; --- 霸体
    FROZEN                                                       =   4 ; --- 冰冻
    FROZEN_WEAKENED                                              =   5 ; --- 次级冰冻
    STUN                                                         =   6 ; --- 眩晕
    STUN_WEAKENED                                                =   7 ; --- 次级眩晕
    DAMAGE_IMM                                                   =   8 ; --- 伤害免疫
    BONDAGE                                                      =   9 ; --- 束缚
    BONDAGE_WEAKENED                                             =  10 ; --- 次级束缚
    SEARCHED_IMMUNITY                                            =  11 ; --- 无法选定
    HIDE_MODEL                                                   =  12 ; --- 隐藏模型
    CLOSE_MOVE_BLOCK                                             =  13 ; --- 关闭阻挡
    SNEAK                                                        =  14 ; --- 潜行
    INVINCIBLE                                                   =  15 ; --- 无敌
    IMMUNE_KILL                                                  =  16 ; --- 免疫即死
    CURE_IMM                                                     =  17 ; --- 禁疗
    BLINDNESS                                                    =  18 ; --- 致盲
    BLINDNESS_WEAKENED                                           =  19 ; --- 次级致盲
    SLEEP                                                        =  20 ; --- 沉睡
    SLEEP_WEAKENED                                               =  21 ; --- 次级沉睡
    CHARM                                                        =  22 ; --- 魅惑
    CHARM_WEAKENED                                               =  23 ; --- 次级魅惑
    TERROR                                                       =  24 ; --- 恐惧
    TERROR_WEAKENED                                              =  25 ; --- 次级恐惧
    TAUNT                                                        =  26 ; --- 嘲讽
    TAUNT_WEAKENED                                               =  27 ; --- 次级嘲讽
    SILENCE                                                      =  28 ; --- 沉默
    SILENCE_WEAKENED                                             =  29 ; --- 次级沉默
    REDUCE_FOV                                                   =  30 ; --- 视野遮蔽
    IMMUNE_CONTROL                                               =  31 ; --- 免疫控制
    HIDE_OUT                                                     =  32 ; --- 隐匿
    BATTLE_OUT                                                   =  33 ; --- 未参战
    DYINGSUA                                                     =  34 ; --- 濒死霸体
    DODGE_CROSS_OBSTACLE                                         =  35 ; --- 闪避穿越障碍物
    PENETRATE                                                    =  36 ; --- 穿透
    FORBIDDEN_RUSH                                               =  37 ; --- 禁止疾跑
    UNPARALLELED                                                 =  38 ; --- 无双
    INDEFENSE                                                    =  39 ; --- 塔防
    MAX                                                          =  40 ; --- 最大数量
}

GameEnum.playerAttributeType =
{
    ADD_ENERGY                                                   =   0 ; --- 支援能量获取效率
    FRONT_ADD_ENERGY                                             =   1 ; --- 主控能量获取效率
    ADSORPTION_CHANGE                                            =   2 ; --- 吸血鬼掉落物吸附距离修正
    MAX                                                          =   3 ; --- 最大效果数量
}

GameEnum.parameterType =
{
    BASE_VALUE                                                   =   1 ; --- 基础值
    PERCENTAGE                                                   =   2 ; --- 百分比
    ABSOLUTE_VALUE                                               =   3 ; --- 绝对值
}

GameEnum.specifyType =
{
    SPECIFIC_SLOT                                                =   1 ; --- 特定槽位
    SPECIFIC_ID                                                  =   2 ; --- 特定ID
    SPECIFIC_TAG                                                 =   3 ; --- 特定Tag
    SPECIFIC_GROUP                                               =   4 ; --- 特定组
    ALL                                                          =   5 ; --- 全部
    BEDAMEGE_REDUCE                                              =   6 ; --- 受击时减少1层
    SHIELDVALUE_ZERO                                             =   7 ; --- 当前护盾值为0减少1层
}


GameEnum.targetType =
{
    AllActor                                                     =   1 ; --- 场上全体对象
    Player                                                       =   2 ; --- 玩家场上角色
    PlayerGroup                                                  =   3 ; --- 玩家全队角色
    AllMonster                                                   =   4 ; --- 所有敌方怪物
    AllTrap                                                      =   5 ; --- 所有陷阱
}

GameEnum.levelTypeData =
{
    None                                                         =   0 ; --- 无
    Exclusive                                                    =   1 ; --- 潜能等级
    Actor                                                        =   2 ; --- 角色等级
    SkillSlot                                                    =   3 ; --- 技能槽位
    BreakCount                                                   =   4 ; --- 突破次数
    Note                                                         =   5 ; --- 属性音符等级
    DiscSkill                                                    =   6 ; --- 星盘技能等级
    BuildLevel                                                   =   7 ; --- 构筑等级
}

GameEnum.characterGrade =
{
    SSR                                                          =   1 ; --- SSR
    SR                                                           =   2 ; --- SR
    R                                                            =   3 ; --- R
}

GameEnum.characterJobClass =
{
    Vanguard                                                     =   1 ; --- 先锋
    Balance                                                      =   2 ; --- 均衡
    Support                                                      =   3 ; --- 支援
}

GameEnum.characterAttackType =
{
    MELEE                                                        =   1 ; --- 近战
    RANGED                                                       =   2 ; --- 远程
}

GameEnum.itemType =
{
    Res                                                          =   1 ; --- 资源
    Item                                                         =   2 ; --- 道具
    Char                                                         =   3 ; --- 角色
    Energy                                                       =   4 ; --- 体力
    WorldRankExp                                                 =   5 ; --- 世界等级经验
    RogueItem                                                    =   6 ; --- 遗迹道具
    Disc                                                         =   7 ; --- 星盘
    Equipment                                                    =   9 ; --- 装备
    CharacterSkin                                                =  10 ; --- 角色皮肤
    MonthlyCard                                                  =  11 ; --- 月卡
    Title                                                        =  12 ; --- 头衔
    Honor                                                        =  13 ; --- 称号
    HeadItem                                                     =  14 ; --- 头像
}

GameEnum.distance =
{
    CLOSERANGE                                                   =   1 ; --- 近战
    REMOTE                                                       =   2 ; --- 远程
}

GameEnum.damageSource =
{
    PLAYER                                                       =   1 ; --- 玩家
    MONSTER                                                      =   2 ; --- 怪物
    TRAP                                                         =   3 ; --- 陷阱
    PERK                                                         =   4 ; --- 信条
    FATECARD                                                     =   5 ; --- 命运卡
}

GameEnum.damageType =
{
    NORMAL                                                       =   1 ; --- 普攻
    SKILL                                                        =   2 ; --- 技能
    ULTIMATE                                                     =   3 ; --- 绝招
    OTHER                                                        =   4 ; --- 其他
    MARK                                                         =   5 ; --- 印记
    PROJECTILE                                                   =   6 ; --- 衍生物
    SUMMON                                                       =   7 ; --- 仆从
}

GameEnum.damageEffect =
{
    PHYSICS                                                      =   1 ; --- 物理
    MAGIC                                                        =   2 ; --- 法术
    REAL                                                         =   4 ; --- 真实
    NO_DAMAGE                                                    =   5 ; --- 无伤害
    NO_DAMAGE_APPLY_FEATHER_NO_ANI                               =   6 ; --- 无伤害应用攻击特性无受击动画
    NO_DAMAGE_APPLY_FEATHER                                      =   7 ; --- 无伤害应用攻击特性有受击动画
    NONE                                                         =   8 ; --- 无
}

GameEnum.skillSlotType =
{
    NONE                                                         =   0 ; --- 无
    A                                                            =   1 ; --- 闪避
    B                                                            =   2 ; --- 技能1
    C                                                            =   3 ; --- 技能2
    D                                                            =   4 ; --- 绝招
    NORMAL                                                       =   5 ; --- 普攻
}

GameEnum.timeSuperposition =
{
    DONOTSTACK                                                   =   1 ; --- 不叠加
    RESET                                                        =   2 ; --- 重置
    SUPERPOSITION                                                =   3 ; --- 叠加
}

GameEnum.skillType =
{
    NORMAL                                                       =   1 ; --- 普攻
    OTHER_SKILL                                                  =   2 ; --- 技能
    SKILL                                                        =   3 ; --- 主控技能
    SUPPORT                                                      =   4 ; --- 援护技能
    ULTIMATE                                                     =   5 ; --- 绝招
    DODGE                                                        =   6 ; --- 闪避
    RUSH                                                         =   7 ; --- 疾跑
}