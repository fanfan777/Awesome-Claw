import { createI18n } from "vue-i18n";
import zhCN from "./locales/zh-CN";
import en from "./locales/en";

export type MessageSchema = typeof zhCN;

const savedLocale = localStorage.getItem("openclaw:locale") ?? "zh-CN";

const i18n = createI18n<[MessageSchema], "zh-CN" | "en">({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: "en",
  messages: {
    "zh-CN": zhCN,
    en,
  },
});

export default i18n;
