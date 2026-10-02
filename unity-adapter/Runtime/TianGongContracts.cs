// 来源：天工项目原创代码，未复制第三方代码。

using System;

namespace TianGong.UnityAdapter
{
    [Serializable]
    public sealed class TianGongTraitValue
    {
        public string id;
        public float amount;
    }

    [Serializable]
    public sealed class TianGongNativeMaterial
    {
        public string id;
        public string name;
        public int quantity = 1;
        public float matterUnits;
        public float storedEnergy;
        public TianGongTraitValue[] traits;
        public float valueUnits;
        public float purity = 0.8f;
        public string state = "solid";
        public string kind = "consumable";
        public string[] tags;
        public string[] promptKeywords;
        public string[] supportedEffects;
    }

    [Serializable]
    public sealed class TianGongCraftEnvironment
    {
        public string furnaceId;
        public string name;
        public float availableEnergy;
        public float precision;
        public float valueCost;
    }

    [Serializable]
    public sealed class TianGongCraftRequest
    {
        public string requestId;
        public string gameId;
        public string playerId;
        public string targetType;
        public string[] materialIds;
        public TianGongNativeMaterial[] materials;
        public string prompt;
        public string ruleVersion;
        public int inventoryRevision;
        public TianGongCraftEnvironment environment;
    }

    [Serializable]
    public sealed class TianGongOutcome
    {
        public string label;
        public float probability;
    }

    [Serializable]
    public sealed class TianGongCraftPreview
    {
        public string requestId;
        public string ruleVersion;
        public string targetType;
        public string targetName;
        public string[] effectIds;
        public string[] effectNames;
        public int quality;
        public float successRate;
        public float processEfficiency;
        public bool feasible;
        public string[] violations;
        public TianGongBalanceSheet balanceSheet;
        public TianGongOutcome[] outcomes;
        public string summary;
    }

    [Serializable]
    public sealed class TianGongMatterLedger
    {
        public float input;
        public float product;
        public float byproducts;
        public bool balanced;
    }

    [Serializable]
    public sealed class TianGongEnergyLedger
    {
        public float input;
        public float material;
        public float external;
        public float usefulWork;
        public float productStored;
        public float heatLoss;
        public bool balanced;
    }

    [Serializable]
    public sealed class TianGongValueLedger
    {
        public float input;
        public float product;
        public float byproducts;
        public float irreversibleLoss;
        public bool balanced;
    }

    [Serializable]
    public sealed class TianGongEntropyLedger
    {
        public float operations;
        public float conflict;
        public float control;
        public float final;
    }

    [Serializable]
    public sealed class TianGongBalanceSheet
    {
        public TianGongMatterLedger matter;
        public TianGongEnergyLedger energy;
        public TianGongValueLedger value;
        public TianGongEntropyLedger entropy;
    }

    [Serializable]
    public sealed class TianGongMaterialConsumption
    {
        public string materialId;
        public int amount;
    }

    [Serializable]
    public sealed class TianGongFragmentOutput
    {
        public string id;
        public string name;
        public int amount;
        public float matterUnits;
    }

    [Serializable]
    public sealed class TianGongMaterialSettlement
    {
        public TianGongMaterialConsumption[] consumedMaterials;
        public string[] consumedMaterialIds;
        public TianGongMaterialConsumption[] preservedMaterials;
        public TianGongFragmentOutput fragment;
        public TianGongFragmentOutput[] byproducts;
        public TianGongBalanceSheet balanceSheet;
        public string conservation;
    }

    [Serializable]
    public sealed class TianGongCraftResult
    {
        public string status;
        public string outcome;
        public string materialLoss;
        public TianGongMaterialSettlement settlement;
        public TianGongWeaponPayload weapon;
    }

    [Serializable]
    public sealed class TianGongWeaponPayload
    {
        public string instanceId;
        public string gameId;
        public string prototypeId;
        public string prototypeName;
        public string[] effectIds;
        public string[] effectNames;
        public string quality;
        public int damage;
        public float matterUnits;
        public string visualRecipe;
        public string ruleVersion;
        public string resultSignature;
    }
}
