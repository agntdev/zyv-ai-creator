import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

export const ABOUT = "يساعدك ZYV AI Creator على صياغة فكرة وHook وتسلسل وعنوان ووصف وهاشتاقات لفيديوك القصير.\n\nاكتب موضوعاً واضحاً بعد اختيار أي خيار. المخرجات آلية، لذا راجعها وعدّلها قبل النشر.";
const back = inlineKeyboard([[inlineButton("⬅️ القائمة الرئيسية", "menu:main")]]);

composer.callbackQuery("main:about", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(ABOUT, { reply_markup: back });
});

export default composer;
