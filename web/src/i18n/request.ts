import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import enMessages from "../../messages/en.json";
import zhMessages from "../../messages/zh.json";

const MESSAGES = {
  en: enMessages,
  zh: zhMessages,
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "zh" | "en")) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: MESSAGES[locale as keyof typeof MESSAGES],
  };
});
