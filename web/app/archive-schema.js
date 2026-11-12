import {validateBusinessValue} from './learning-validation.js';
// Public, versioned contract shared by the browser and the account API.
export const ARCHIVE_VERSION = 1;
import {ARCHIVE_KEYS, DATA_DEFINITIONS, WORD_SETTING_CHOICES, LETTER_SETTING_CHOICES, LISTEN_DEFAULTS, LISTEN_CHOICES} from './learning-data.js';
export {ARCHIVE_KEYS} from './learning-data.js';

const record = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const requireValue = (valid, message) => {
  if (!valid) throw new Error(message);
};
function validateDomain(key, data) {
  if (key === "abc-module-content-v1") {
    for (const field of ["title", "letters", "words", "blends"])
      if (field in data)
        requireValue(typeof data[field] === "string", "学习内容字段损坏");
    for (const field of ["wordMeanings", "sentenceTranslations"])
      if (field in data) requireValue(record(data[field]), "学习内容映射损坏");
    for (const value of Object.values(data.wordMeanings || {})) {
      requireValue(record(value), "单词释义损坏");
      if (record(value))
        for (const [field, text] of Object.entries(value))
          requireValue(
            ["zh", "sentence", "sentenceZh"].includes(field) &&
              typeof text === "string" &&
              text.length <= (field === "zh" ? 160 : 500) &&
              !/[\r\n]/.test(text),
            "单词释义内容无效",
          );
    }
    for (const value of Object.values(data.sentenceTranslations || {}))
      requireValue(
        record(value) &&
          typeof value.sentence === "string" &&
          typeof value.zh === "string",
        "例句翻译损坏",
      );
  }
  if (key === "abc-garden-preferences-v2") {
    requireValue(record(data.settings), "学习偏好结构损坏");
    if ("letters" in data.settings)
      requireValue(
        Array.isArray(data.settings.letters) &&
          data.settings.letters.every(
            (x) => typeof x === "string" && /^[A-Z]$/.test(x),
          ),
        "学习字母范围损坏",
      );
    for (const field of ["soundConfirmed", "blending"])
      if (field in data.settings)
        requireValue(
          typeof data.settings[field] === "boolean",
          "学习偏好值无效",
        );
  }
  if (key === 'abc-listen-game-options-v1') {
    requireValue(Object.keys(data).every(k=>k==='version'||k in LISTEN_DEFAULTS), '听音设置包含未知字段');
    for (const [field, fallback] of Object.entries(LISTEN_DEFAULTS))
      requireValue(LISTEN_CHOICES[field] ? LISTEN_CHOICES[field].includes(data[field]) : typeof data[field]===typeof fallback, '听音设置无效');
  }
  const settings = key === 'abc-garden-guided-settings-v1' ? WORD_SETTING_CHOICES : key === 'abc-garden-guided-letters-settings-v1' ? LETTER_SETTING_CHOICES : null;
  if (settings && Object.keys(data).some(field=>field!=='version' && !(field in settings))) throw Error('陪学设置包含未知字段');
  if (settings)
    for (const [field, values] of Object.entries(settings))
      requireValue(values.includes(data[field]), "陪学设置无效");
  if (
    ["abc-garden-guided-words-v1", "abc-garden-guided-letters-v1"].includes(key)
  ) {
    requireValue(record(data.entries), "陪学记录结构损坏");
    for (const field of ["scope", "observations", "archivedEntries"])
      if (field in data)
        requireValue(Array.isArray(data[field]), "陪学记录列表损坏");
    if (data.session !== undefined && data.session !== null)
      requireValue(record(data.session), "陪学过程损坏");
    if (key === "abc-garden-guided-words-v1")
      for (const entry of Object.values(data.entries)) {
        requireValue(
          record(entry) &&
            Number.isFinite(entry.seenAt) &&
            Number.isFinite(entry.dueAt),
          "单词陪学进度损坏",
        );
        if ("days" in entry)
          requireValue(
            Array.isArray(entry.days) &&
              entry.days.every(
                (day) =>
                  typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day),
              ),
            "复习日期损坏",
          );
      }
    if (key === "abc-garden-guided-letters-v1")
      for (const [letter, entry] of Object.entries(data.entries)) {
        requireValue(
          /^[A-Z]$/.test(letter) && record(entry),
          "字母陪学记录损坏",
        );
        for (const [skill, value] of Object.entries(entry))
          requireValue(
            ["name", "sound", "case"].includes(skill) &&
              record(value) &&
              typeof value.taught === "boolean" &&
              Array.isArray(value.days) &&
              Number.isInteger(value.level) &&
              value.level >= 0 &&
              value.level <= 3,
            "字母技能记录损坏",
          );
      }
  }
}

export function validateArchive(value) {
  if (
    !value ||
    value.version !== ARCHIVE_VERSION ||
    value.subject !== "abc" ||
    !value.data ||
    typeof value.data !== "object" ||
    Array.isArray(value.data) ||
    Object.keys(value).some(
      (key) => !["version", "subject", "data"].includes(key),
    )
  ) {
    throw new Error("存档格式不受支持，请更新页面后重试");
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > 800000)
    throw new Error("存档超过容量限制");
  for (const [key, data] of Object.entries(value.data)) {
    if (
      !ARCHIVE_KEYS.includes(key) ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    )
      throw new Error("存档字段无效");
    if (DATA_DEFINITIONS[key].version !== null && data.version !== DATA_DEFINITIONS[key].version)
      throw new Error("学习记录版本不受支持，请保留原存档");
    if (key === "abc-garden-mastery-v1") {
      const entries = data.entries;
      if (!entries || typeof entries !== "object" || Array.isArray(entries))
        throw new Error("掌握记录结构损坏，已保留原记录");
      for (const [word, entry] of Object.entries(entries)) {
        if (
          !/^[a-z][a-z '-]{0,49}$/.test(word) ||
          !entry ||
          typeof entry !== "object" ||
          Array.isArray(entry) ||
          typeof entry.mastered !== "boolean"
        )
          throw new Error("掌握记录内容损坏，已保留原记录");
        if (
          entry.source !== undefined &&
          !["manual", "auto"].includes(entry.source)
        )
          throw new Error("掌握记录来源无效");
        if (
          entry.dates !== undefined &&
          (!Array.isArray(entry.dates) ||
            entry.dates.some(
              (day) =>
                typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day),
            ))
        )
          throw new Error("掌握记录日期无效");
      }
    }
    validateDomain(key, data);
    if ("clips" in data || "customAudio" in data)
      throw new Error("云存档暂不包含录音");
  }
  const pending = [{ value, depth: 0 }];
  while (pending.length) {
    const item = pending.pop();
    if (typeof item.value === "number" && !Number.isFinite(item.value))
      throw new Error("存档数字无效");
    if (item.depth > 40) throw new Error("存档层级过深");
    if (
      typeof item.value === "string" &&
      (item.value.length > 12000 || item.value.startsWith("data:audio/"))
    )
      throw new Error("存档文本无效");
    if (item.value && typeof item.value === "object") {
      for (const [key, nested] of Object.entries(item.value)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw new Error("存档包含无效字段");
        pending.push({ value: nested, depth: item.depth + 1 });
      }
    }
  }
  for (const [key, data] of Object.entries(value.data)) validateBusinessValue(key, data);
  return value;
}
