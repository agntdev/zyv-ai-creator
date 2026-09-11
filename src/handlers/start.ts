import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { MAIN_MENU, MAIN_MENU_TEXT } from "./main-start.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

export const WELCOME = "مرحباً بك في ZYV AI Creator.\nحوّل موضوعك إلى حزمة فيديو قصيرة بالعربية خلال دقائق.\nلا نحتفظ بسجل طويل لمحادثاتك.";
export const ONBOARDING = inlineKeyboard([
  [inlineButton("🚀 ابدأ", "main:start")],
  [inlineButton("ℹ️ عن البوت", "main:about")],
]);

composer.command("start", async (ctx) => {
  ctx.session.step = undefined;
  await ctx.reply(WELCOME, { reply_markup: ONBOARDING });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = undefined;
  await ctx.editMessageText(MAIN_MENU_TEXT, { reply_markup: MAIN_MENU });
});

export default composer;
