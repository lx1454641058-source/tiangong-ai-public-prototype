// 来源：天工项目原创代码，未复制第三方代码。

using System;
using System.Linq;
using RGame.RoguelikeKit;
using UnityEngine;

namespace TianGong.UnityAdapter
{
    public sealed class TianGongWeaponBridge : MonoBehaviour
    {
        public event Action<TianGongWeaponPayload> WeaponApplied;

        public SkillDataSO BuildSkillData(SkillDataSO baseSkill, TianGongWeaponPayload weapon)
        {
            if (baseSkill == null) throw new ArgumentNullException(nameof(baseSkill));
            if (weapon == null) throw new ArgumentNullException(nameof(weapon));

            SkillDataSO generated = baseSkill.Copy();
            generated.Key = $"tg_{weapon.instanceId}";
            generated.Damage = weapon.damage;
            generated.Description = $"天工生成武器：{weapon.prototypeName}。效果：{string.Join("、", weapon.effectNames ?? Array.Empty<string>())}";
            return generated;
        }

        public bool HasEffect(TianGongWeaponPayload weapon, string effectId)
        {
            return weapon?.effectIds != null && weapon.effectIds.Contains(effectId, StringComparer.Ordinal);
        }

        public void Apply(TianGongWeaponPayload weapon)
        {
            if (weapon == null) throw new ArgumentNullException(nameof(weapon));
            if (string.IsNullOrWhiteSpace(weapon.resultSignature))
                throw new InvalidOperationException("拒绝应用没有服务器签名的天工结果。");

            WeaponApplied?.Invoke(weapon);
        }
    }
}
