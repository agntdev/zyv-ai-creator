import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

export const MAIN_MENU = inlineKeyboard([
  [inlineButton("🎬 فكرة فيديو", "action:idea"), inlineButton("⚡ Hook قوي", "action:hook")],
  [inlineButton("📝 كتابة سكربت", "action:script"), inlineButton("🏷️ عنوان ووصف", "action:title")],
  [inlineButton("#️⃣ هاشتاقات", "action:hashtags"), inlineButton("🎮 أفكار Fortnite", "action:fortnite")],
  [inlineButton("💡 أفكار محتوى", "action:content"), inlineButton("🔄 إعادة التوليد", "action:regenerate")],
  [inlineButton("ℹ️ عن البوت", "main:about")],
]);

export const MAIN_MENU_TEXT = "اختر ما تريد تحضيره لفيديوك:";

composer.callbackQuery("main:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = undefined;
  await ctx.editMessageText(MAIN_MENU_TEXT, { reply_markup: MAIN_MENU });
});

export default composer;
