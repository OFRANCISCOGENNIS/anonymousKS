'use strict';
// ============================================================================
// MOTOR DE CÁLCULO DETERMINÍSTICO (Módulos 3, 4, 14)
// JS puro, sem dependências. Toda função é pura: mesmo input → mesmo output.
// Cada resultado carrega { value, formula, source, confidence } — auditável.
// ============================================================================

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------------------
// TMB / BMR
// ---------------------------------------------------------------------------
function bmrMifflinStJeor({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const value = sex === 'M' ? base + 5 : base - 161;
  return { value: round(value, 0), formula: 'MIFFLIN_ST_JEOR', source: 'Mifflin et al. 1990', confidence: 'high' };
}

function bmrKatchMcArdle({ lbmKg }) {
  return { value: round(370 + 21.6 * lbmKg, 0), formula: 'KATCH_MCARDLE', source: 'Katch & McArdle 1996', confidence: 'high' };
}

function bmrHarrisBenedict({ weightKg, heightCm, age, sex }) {
  const value = sex === 'M'
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age;
  return { value: round(value, 0), formula: 'HARRIS_BENEDICT', source: 'Roza & Shizgal 1984', confidence: 'medium' };
}

// Seleção de fórmula por regra: Katch-McArdle se %gordura confiável, senão Mifflin.
function bmr(profile) {
  if (profile.bodyFatPct != null && profile.bfConfidence === 'high') {
    const lbmKg = profile.weightKg * (1 - profile.bodyFatPct / 100);
    return bmrKatchMcArdle({ lbmKg });
  }
  return bmrMifflinStJeor(profile);
}

// ---------------------------------------------------------------------------
// TDEE — fatores de atividade padronizados
// ---------------------------------------------------------------------------
const ACTIVITY_FACTORS = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, athlete: 1.9,
};

function tdee(profile) {
  const b = bmr(profile);
  const factor = ACTIVITY_FACTORS[profile.activityLevel];
  if (!factor) throw new Error(`activityLevel inválido: ${profile.activityLevel}`);
  return { value: round(b.value * factor, 0), formula: `${b.formula} x AF(${factor})`, source: b.source, confidence: b.confidence };
}

// ---------------------------------------------------------------------------
// %Gordura — US Navy
// ---------------------------------------------------------------------------
function bodyFatUsNavy({ sex, heightCm, waistCm, neckCm, hipCm }) {
  const log10 = Math.log10;
  let value;
  if (sex === 'M') {
    value = 495 / (1.0324 - 0.19077 * log10(waistCm - neckCm) + 0.15456 * log10(heightCm)) - 450;
  } else {
    if (hipCm == null) throw new Error('hipCm obrigatório para sexo F na fórmula US Navy');
    value = 495 / (1.29579 - 0.35004 * log10(waistCm + hipCm - neckCm) + 0.22100 * log10(heightCm)) - 450;
  }
  return { value: round(value, 1), formula: 'US_NAVY_BF', source: 'Hodgdon & Beckett 1984', confidence: 'medium', errorMargin: '±3-4%' };
}

// ---------------------------------------------------------------------------
// Meta calórica + macros (Módulo 4) — faixas ISSN codificadas
// ---------------------------------------------------------------------------
const GOAL_KCAL_ADJUST = {
  fat_loss:    { deltaPct: -20, guideline: 'DEFICIT_PCT 15-25% TDEE (Helms 2014)' },
  hypertrophy: { deltaPct: +10, guideline: 'SURPLUS_PCT 5-15% TDEE (Iraki 2019)' },
  maintenance: { deltaPct: 0,   guideline: 'manutenção' },
};

function targetKcal(profile) {
  const t = tdee(profile);
  const adj = GOAL_KCAL_ADJUST[profile.goal] || GOAL_KCAL_ADJUST.maintenance;
  const bmrFloor = bmr(profile).value * 1.1; // piso de segurança: nunca abaixo de 1,1×TMB
  const raw = t.value * (1 + adj.deltaPct / 100);
  return {
    value: round(Math.max(raw, bmrFloor), 0),
    formula: `TDEE ${adj.deltaPct >= 0 ? '+' : ''}${adj.deltaPct}%`,
    source: adj.guideline,
    confidence: t.confidence,
    flooredAtBmr: raw < bmrFloor,
  };
}

function macros(profile) {
  const kcal = targetKcal(profile);
  // Proteína: em déficit usa g/kg LBM alto (Helms); senão faixa ISSN por kg.
  let proteinG, proteinSrc;
  if (profile.goal === 'fat_loss' && profile.bodyFatPct != null) {
    const lbm = profile.weightKg * (1 - profile.bodyFatPct / 100);
    proteinG = round(2.6 * lbm, 0);
    proteinSrc = 'Helms 2014: 2,3-3,1 g/kg LBM em déficit';
  } else {
    proteinG = round(1.8 * profile.weightKg, 0);
    proteinSrc = 'ISSN 2017: 1,4-2,0 g/kg';
  }
  const fatG = round(0.8 * profile.weightKg, 0); // ISSN: mínimo 0,6-0,8 g/kg
  const carbG = round(Math.max(0, (kcal.value - proteinG * 4 - fatG * 9) / 4), 0);
  const fiberG = round(14 * kcal.value / 1000, 0); // IOM/DRI: 14 g/1000 kcal
  return {
    kcal: kcal.value, proteinG, fatG, carbG, fiberG,
    sources: { kcal: kcal.source, protein: proteinSrc, fat: 'ISSN 2017: ≥0,8 g/kg', fiber: 'IOM/DRI 2005' },
    confidence: kcal.confidence,
  };
}

function waterMl({ weightKg, trainingMinPerDay = 0 }) {
  const value = 35 * weightKg + Math.round(trainingMinPerDay / 60) * 750;
  return { value: Math.round(value), formula: 'WATER_ML_KG', source: 'EFSA 2010 (35 ml/kg + treino)', confidence: 'medium' };
}

// ---------------------------------------------------------------------------
// Performance (Módulo 14)
// ---------------------------------------------------------------------------
function oneRepMaxEpley({ loadKg, reps }) {
  if (reps < 1) throw new Error('reps >= 1');
  const value = reps === 1 ? loadKg : loadKg * (1 + reps / 30);
  return { value: round(value, 1), formula: 'EPLEY_1RM', source: 'Epley 1985', confidence: reps <= 10 ? 'high' : 'low' };
}

function hrMaxTanaka({ age }) {
  return { value: Math.round(208 - 0.7 * age), formula: 'TANAKA_HRMAX', source: 'Tanaka 2001', confidence: 'medium', errorMargin: '±7-10 bpm' };
}

function hrZonesKarvonen({ age, hrRest }) {
  const hrMax = hrMaxTanaka({ age }).value;
  const zone = (lo, hi) => ({
    min: Math.round(hrRest + lo * (hrMax - hrRest)),
    max: Math.round(hrRest + hi * (hrMax - hrRest)),
  });
  return {
    hrMax,
    zones: { z1: zone(0.5, 0.6), z2: zone(0.6, 0.7), z3: zone(0.7, 0.8), z4: zone(0.8, 0.9), z5: zone(0.9, 1.0) },
    formula: 'KARVONEN_HR + TANAKA_HRMAX', source: 'Karvonen 1957; Tanaka 2001', confidence: 'medium',
  };
}

function bmi({ weightKg, heightCm }) {
  const h = heightCm / 100;
  return { value: round(weightKg / (h * h), 1), formula: 'BMI', source: 'OMS', confidence: 'high' };
}

function ffmi({ weightKg, heightCm, bodyFatPct }) {
  const h = heightCm / 100;
  const lbm = weightKg * (1 - bodyFatPct / 100);
  const value = lbm / (h * h) + 6.1 * (1.8 - h);
  return { value: round(value, 1), formula: 'FFMI', source: 'Kouri 1995', confidence: 'medium' };
}

module.exports = {
  bmr, bmrMifflinStJeor, bmrKatchMcArdle, bmrHarrisBenedict,
  tdee, targetKcal, macros, waterMl,
  bodyFatUsNavy, oneRepMaxEpley, hrMaxTanaka, hrZonesKarvonen, bmi, ffmi,
  ACTIVITY_FACTORS,
};
